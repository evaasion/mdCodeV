use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    ".cache",
    ".idea",
    ".vscode",
];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root_path: String,
    pub project_type: String,
    pub manifest_path: Option<String>,
    pub server_cfg_path: Option<String>,
    pub resources: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpStatus {
    pub connected: bool,
    pub host: Option<String>,
    pub username: Option<String>,
    pub port: Option<u16>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFile {
    pub path: String,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpConnectConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Clone)]
pub(crate) struct StoredSftp {
    config: SftpConnectConfig,
    home_dir: String,
}

pub struct SftpState(pub Mutex<Option<StoredSftp>>);

struct ActiveSftp {
    #[allow(dead_code)]
    session: Session,
    sftp: ssh2::Sftp,
}

fn is_ignored(name: &str) -> bool {
    IGNORED_DIRS.contains(&name) || name.starts_with('.')
}

fn is_likely_text(name: &str) -> bool {
    if name == "fxmanifest.lua" || name == "server.cfg" {
        return true;
    }
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    matches!(
        ext.as_str(),
        "lua" | "js" | "ts" | "json" | "xml" | "html" | "css" | "md" | "txt" | "cfg" | "yml" | "yaml" | "toml"
    )
}

fn join_remote(base: &str, segment: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.is_empty() {
        return format!("/{segment}");
    }
    format!("{base}/{segment}")
}

fn resolve_remote_path(path: &str, home_dir: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed == "." {
        return home_dir.to_string();
    }
    if trimmed.starts_with('/') {
        return trimmed.to_string();
    }
    join_remote(home_dir, trimmed)
}

fn entry_full_path(parent: &str, entry: &Path, home_dir: &str) -> String {
    let raw = entry.to_string_lossy();
    if raw.starts_with('/') {
        return raw.to_string();
    }

    let name = entry
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .unwrap_or(raw.as_ref());

    let parent = resolve_remote_path(parent, home_dir);
    join_remote(&parent, name)
}

fn connect_ssh(config: &SftpConnectConfig) -> Result<Session, String> {
    let addr = format!("{}:{}", config.host, config.port);
    let tcp = TcpStream::connect(&addr).map_err(|error| format!("Connexion impossible ({addr}): {error}"))?;
    tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
        .map_err(|error| error.to_string())?;
    tcp.set_write_timeout(Some(std::time::Duration::from_secs(30)))
        .map_err(|error| error.to_string())?;

    let mut session = Session::new().map_err(|error| error.to_string())?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|error| format!("Handshake SSH échoué: {error}"))?;

    match config.auth_type.as_str() {
        "password" => {
            let password = config.password.clone().unwrap_or_default();
            session
                .userauth_password(&config.username, &password)
                .map_err(|error| format!("Auth mot de passe échouée: {error}"))?;
        }
        "privateKey" => {
            let key_path = config
                .private_key_path
                .as_ref()
                .ok_or("Chemin de clé privée requis")?;
            session
                .userauth_pubkey_file(
                    &config.username,
                    None,
                    Path::new(key_path),
                    config.passphrase.as_deref(),
                )
                .map_err(|error| format!("Auth clé privée échouée: {error}"))?;
        }
        other => return Err(format!("Type d'auth inconnu: {other}")),
    }

    if !session.authenticated() {
        return Err("Authentification SSH échouée".to_string());
    }

    Ok(session)
}

fn connect_session(config: &SftpConnectConfig) -> Result<ActiveSftp, String> {
    let session = connect_ssh(config)?;
    let sftp = session
        .sftp()
        .map_err(|error| format!("Canal SFTP indisponible: {error}"))?;

    Ok(ActiveSftp { session, sftp })
}

fn read_channel_stream<R: Read>(reader: &mut R) -> String {
    let mut output = String::new();
    let mut buf = [0u8; 8192];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => output.push_str(&String::from_utf8_lossy(&buf[..n])),
            Err(_) => break,
        }
    }
    output
}

fn ssh_run_command(session: &Session, command: &str) -> Result<SshExecResult, String> {
    let mut channel = session
        .channel_session()
        .map_err(|error| format!("Canal SSH indisponible: {error}"))?;
    channel
        .exec(command)
        .map_err(|error| format!("Commande SSH échouée: {error}"))?;

    let stdout = read_channel_stream(&mut channel);
    let mut stderr_stream = channel.stderr();
    let stderr = read_channel_stream(&mut stderr_stream);

    channel.wait_close().ok();
    let exit_code = channel.exit_status().unwrap_or(-1);

    Ok(SshExecResult {
        stdout,
        stderr,
        exit_code,
    })
}

fn with_ssh<T>(state: &SftpState, action: impl FnOnce(&Session) -> Result<T, String>) -> Result<T, String> {
    let stored = {
        let guard = state.0.lock().map_err(|_| "État SFTP verrouillé".to_string())?;
        guard
            .clone()
            .ok_or("Aucune session SSH — connecte-toi au VPS d'abord".to_string())?
    };

    let session = connect_ssh(&stored.config)?;
    action(&session)
}

fn apply_console_template(template: &str, command: &str) -> String {
    let escaped = command
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "'\\''");
    template.replace("{command}", &escaped)
}

fn shell_quote(path: &str) -> String {
    format!("'{}'", path.replace('\'', "'\"'\"'"))
}

fn with_sftp<T>(
    state: &SftpState,
    action: impl FnOnce(&ssh2::Sftp, &str) -> Result<T, String>,
) -> Result<T, String> {
    let stored = {
        let guard = state.0.lock().map_err(|_| "État SFTP verrouillé".to_string())?;
        guard
            .clone()
            .ok_or("Aucune session SFTP — connecte-toi au VPS d'abord".to_string())?
    };

    let active = connect_session(&stored.config)?;
    action(&active.sftp, &stored.home_dir)
}

fn sftp_read_text(sftp: &ssh2::Sftp, path: &str) -> Result<String, String> {
    let mut file = sftp
        .open(Path::new(path))
        .map_err(|error| format!("Lecture impossible ({path}): {error}"))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|error| format!("Lecture impossible ({path}): {error}"))?;
    Ok(content)
}

fn sftp_mkdir_p(sftp: &ssh2::Sftp, path: &str) -> Result<(), String> {
    if path.is_empty() || path == "/" {
        return Ok(());
    }

    let is_abs = path.starts_with('/');
    let parts: Vec<&str> = path.split('/').filter(|part| !part.is_empty()).collect();
    let mut current = if is_abs { String::new() } else { String::new() };

    for part in parts {
        current = if current.is_empty() {
            if is_abs {
                format!("/{part}")
            } else {
                part.to_string()
            }
        } else if current == "/" {
            format!("/{part}")
        } else {
            format!("{current}/{part}")
        };
        let _ = sftp.mkdir(Path::new(&current), 0o755);
    }

    Ok(())
}

fn sftp_write_text(sftp: &ssh2::Sftp, path: &str, content: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent().and_then(|p| p.to_str()) {
        sftp_mkdir_p(sftp, parent)?;
    }

    let mut file = sftp
        .create(Path::new(path))
        .map_err(|error| format!("Écriture impossible ({path}): {error}"))?;
    file.write_all(content.as_bytes())
        .map_err(|error| format!("Écriture impossible ({path}): {error}"))?;
    Ok(())
}

fn sftp_file_exists(sftp: &ssh2::Sftp, path: &str) -> bool {
    sftp.stat(Path::new(path)).is_ok()
}

fn collect_readdir(dir: &mut ssh2::File) -> Vec<(PathBuf, ssh2::FileStat)> {
    let mut entries = Vec::new();
    loop {
        match dir.readdir() {
            Ok(entry) => entries.push(entry),
            Err(_) => break,
        }
    }
    entries
}

fn build_tree(
    sftp: &ssh2::Sftp,
    path: &str,
    home_dir: &str,
    max_depth: u8,
) -> Result<Vec<FileNode>, String> {
    if max_depth == 0 {
        return Ok(vec![]);
    }

    let resolved = resolve_remote_path(path, home_dir);
    let mut dir = sftp
        .opendir(Path::new(&resolved))
        .map_err(|error| format!("Liste impossible ({resolved}): {error}"))?;

    let mut nodes = Vec::new();
    for (entry_path, stat) in collect_readdir(&mut dir) {
        let name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() || is_ignored(&name) {
            continue;
        }

        let is_dir = stat.is_dir();
        if !is_dir && !is_likely_text(&name) {
            continue;
        }

        let full_path = entry_full_path(&resolved, &entry_path, home_dir);
        let children = if is_dir && max_depth > 1 {
            Some(build_tree(sftp, &full_path, home_dir, max_depth - 1)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: full_path,
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

fn detect_project_on_sftp(
    sftp: &ssh2::Sftp,
    root_path: &str,
    home_dir: &str,
) -> Result<ProjectInfo, String> {
    let resolved = resolve_remote_path(root_path, home_dir);
    if !sftp_file_exists(sftp, &resolved) {
        return Err(format!("Le dossier distant n'existe pas ({resolved})"));
    }

    let manifest_path = find_manifest(sftp, &resolved, home_dir);
    let server_cfg_path = find_server_cfg(sftp, &resolved);
    let resources = find_resources(sftp, &resolved, home_dir);

    let project_type = if manifest_path.is_some() {
        "resource".to_string()
    } else if server_cfg_path.is_some() || !resources.is_empty() {
        "server".to_string()
    } else {
        "unknown".to_string()
    };

    Ok(ProjectInfo {
        root_path: resolved,
        project_type,
        manifest_path,
        server_cfg_path,
        resources,
    })
}

fn find_manifest(sftp: &ssh2::Sftp, root: &str, home_dir: &str) -> Option<String> {
    let direct = join_remote(root, "fxmanifest.lua");
    if sftp_file_exists(sftp, &direct) {
        return Some(direct);
    }

    let Ok(mut dir) = sftp.opendir(Path::new(root)) else {
        return None;
    };

    for (entry_path, stat) in collect_readdir(&mut dir) {
        if !stat.is_dir() {
            continue;
        }
        let dir_path = entry_full_path(root, &entry_path, home_dir);
        let child = join_remote(&dir_path, "fxmanifest.lua");
        if sftp_file_exists(sftp, &child) {
            return Some(child);
        }
    }

    None
}

fn find_server_cfg(sftp: &ssh2::Sftp, root: &str) -> Option<String> {
    let direct = join_remote(root, "server.cfg");
    if sftp_file_exists(sftp, &direct) {
        Some(direct)
    } else {
        None
    }
}

fn find_resources(sftp: &ssh2::Sftp, root: &str, _home_dir: &str) -> Vec<String> {
    let resources_dir = join_remote(root, "resources");
    let listing_path = if sftp_file_exists(sftp, &resources_dir) {
        resources_dir
    } else {
        root.to_string()
    };

    let Ok(mut dir) = sftp.opendir(Path::new(&listing_path)) else {
        return vec![];
    };

    let mut resources = Vec::new();
    for (entry_path, stat) in collect_readdir(&mut dir) {
        if stat.is_dir() {
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                resources.push(name.to_string());
            }
        }
    }

    resources.sort();
    resources
}

#[tauri::command]
pub fn sftp_connect(state: State<SftpState>, config: SftpConnectConfig) -> Result<SftpStatus, String> {
    let active = connect_session(&config)?;
    let home_dir = active
        .sftp
        .realpath(Path::new("."))
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|_| "/".to_string());

    let mut guard = state.0.lock().map_err(|_| "État SFTP verrouillé".to_string())?;
    *guard = Some(StoredSftp {
        config: config.clone(),
        home_dir,
    });

    Ok(SftpStatus {
        connected: true,
        host: Some(config.host),
        username: Some(config.username),
        port: Some(config.port),
    })
}

#[tauri::command]
pub fn sftp_disconnect(state: State<SftpState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "État SFTP verrouillé".to_string())?;
    *guard = None;
    Ok(())
}

#[tauri::command]
pub fn sftp_status(state: State<SftpState>) -> Result<SftpStatus, String> {
    let guard = state.0.lock().map_err(|_| "État SFTP verrouillé".to_string())?;
    if let Some(stored) = guard.as_ref() {
        Ok(SftpStatus {
            connected: true,
            host: Some(stored.config.host.clone()),
            username: Some(stored.config.username.clone()),
            port: Some(stored.config.port),
        })
    } else {
        Ok(SftpStatus {
            connected: false,
            host: None,
            username: None,
            port: None,
        })
    }
}

#[tauri::command]
pub fn sftp_list_directory(state: State<SftpState>, path: String) -> Result<Vec<FileNode>, String> {
    with_sftp(&state, |sftp, home_dir| {
        let resolved = resolve_remote_path(&path, home_dir);
        let mut dir = sftp
            .opendir(Path::new(&resolved))
            .map_err(|error| format!("Dossier inaccessible ({resolved}): {error}"))?;

        let mut nodes = Vec::new();
        for (entry_path, stat) in collect_readdir(&mut dir) {
            let name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() || name == "." || name == ".." || is_ignored(&name) {
                continue;
            }

            nodes.push(FileNode {
                name,
                path: entry_full_path(&resolved, &entry_path, home_dir),
                is_dir: stat.is_dir(),
                children: None,
            });
        }

        nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(nodes)
    })
}

#[tauri::command]
pub fn sftp_read_file(state: State<SftpState>, path: String) -> Result<String, String> {
    with_sftp(&state, |sftp, home_dir| {
        let resolved = resolve_remote_path(&path, home_dir);
        sftp_read_text(sftp, &resolved)
    })
}

#[tauri::command]
pub fn sftp_write_file(state: State<SftpState>, path: String, content: String) -> Result<(), String> {
    with_sftp(&state, |sftp, home_dir| {
        let resolved = resolve_remote_path(&path, home_dir);
        sftp_write_text(sftp, &resolved, &content)
    })
}

#[tauri::command]
pub fn sftp_list_project_tree(state: State<SftpState>, path: String) -> Result<Vec<FileNode>, String> {
    with_sftp(&state, |sftp, home_dir| build_tree(sftp, &path, home_dir, 1))
}

#[tauri::command]
pub fn sftp_detect_project(state: State<SftpState>, root_path: String) -> Result<ProjectInfo, String> {
    with_sftp(&state, |sftp, home_dir| detect_project_on_sftp(sftp, &root_path, home_dir))
}

#[tauri::command]
pub fn sftp_write_scaffold(
    state: State<SftpState>,
    root_path: String,
    resource_name: String,
    files: HashMap<String, String>,
) -> Result<Vec<String>, String> {
    with_sftp(&state, |sftp, home_dir| {
        let resolved_root = resolve_remote_path(&root_path, home_dir);
        let resource_dir = join_remote(&resolved_root, &resource_name);
        sftp_mkdir_p(sftp, &resource_dir)?;

        let mut written = Vec::new();
        for (relative, content) in files {
            let file_path = join_remote(&resource_dir, &relative);
            if let Some(parent) = Path::new(&file_path).parent().and_then(|p| p.to_str()) {
                sftp_mkdir_p(sftp, parent)?;
            }
            sftp_write_text(sftp, &file_path, &content)?;
            written.push(file_path);
        }

        Ok(written)
    })
}

#[tauri::command]
pub fn sftp_list_plugin_files(
    state: State<SftpState>,
    project_path: Option<String>,
) -> Result<Vec<PluginFile>, String> {
    with_sftp(&state, |sftp, home_dir| {
        let mut files = Vec::new();
        if let Some(project) = project_path {
            let resolved_project = resolve_remote_path(&project, home_dir);
            let dir = join_remote(&resolved_project, ".mdcodev/plugins");
            if !sftp_file_exists(sftp, &dir) {
                return Ok(files);
            }

            let mut remote_dir = sftp
                .opendir(Path::new(&dir))
                .map_err(|error| format!("Plugins distants inaccessibles: {error}"))?;

            for (entry_path, stat) in collect_readdir(&mut remote_dir) {
                if stat.is_dir() {
                    continue;
                }
                let name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("plugin.json")
                    .to_string();
                if name.ends_with(".json") {
                    files.push(PluginFile {
                        path: entry_full_path(&dir, &entry_path, home_dir),
                        name,
                    });
                }
            }
        }
        Ok(files)
    })
}

#[tauri::command]
pub fn sftp_ensure_plugins_dir(
    state: State<SftpState>,
    project_path: Option<String>,
) -> Result<Vec<String>, String> {
    with_sftp(&state, |sftp, home_dir| {
        let mut created = Vec::new();
        if let Some(project) = project_path {
            let resolved_project = resolve_remote_path(&project, home_dir);
            let dir = join_remote(&resolved_project, ".mdcodev/plugins");
            if !sftp_file_exists(sftp, &dir) {
                sftp_mkdir_p(sftp, &dir)?;
                created.push(dir);
            }
        }
        Ok(created)
    })
}

#[tauri::command]
pub fn ssh_exec(state: State<SftpState>, command: String) -> Result<SshExecResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Commande SSH vide".to_string());
    }
    with_ssh(&state, |session| ssh_run_command(session, trimmed))
}

#[tauri::command]
pub fn ssh_send_console_command(
    state: State<SftpState>,
    command: String,
    template: String,
) -> Result<SshExecResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Commande console vide".to_string());
    }
    let shell = apply_console_template(&template, trimmed);
    with_ssh(&state, |session| ssh_run_command(session, &shell))
}

#[tauri::command]
pub fn ssh_fetch_logs(
    state: State<SftpState>,
    log_path: String,
    lines: Option<u32>,
) -> Result<SshExecResult, String> {
    let resolved_lines = lines.unwrap_or(120).clamp(10, 2000);
    let trimmed = log_path.trim();
    if trimmed.is_empty() {
        return Err("Chemin de log distant requis".to_string());
    }
    let shell = format!("tail -n {resolved_lines} {}", shell_quote(trimmed));
    with_ssh(&state, |session| ssh_run_command(session, &shell))
}