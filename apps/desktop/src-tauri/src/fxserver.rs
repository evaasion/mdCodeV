use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

pub struct FxServerState {
    inner: Mutex<FxServerInner>,
}

struct FxServerInner {
    child: Option<Child>,
    server_root: Option<String>,
}

impl FxServerState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(FxServerInner {
                child: None,
                server_root: None,
            }),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerLogLine {
    pub stream: String,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub server_root: Option<String>,
    pub pid: Option<u32>,
}

fn emit_log(app: &AppHandle, stream: &str, text: String) {
    let _ = app.emit(
        "server-log",
        ServerLogLine {
            stream: stream.to_string(),
            text,
        },
    );
}

fn spawn_log_reader(app: AppHandle, stream: &str, reader: impl BufRead + Send + 'static) {
    let stream_name = stream.to_string();
    thread::spawn(move || {
        for line in reader.lines() {
            match line {
                Ok(text) => emit_log(&app, &stream_name, text),
                Err(_) => break,
            }
        }
    });
}

fn candidate_paths(server_root: &Path) -> Vec<PathBuf> {
    let root = server_root.to_path_buf();
    vec![
        root.join("FXServer"),
        root.join("fxserver"),
        root.join("server").join("FXServer"),
        root.join("artifacts").join("FXServer"),
        root.join("alpine").join("opt").join("cfx-server").join("FXServer"),
    ]
}

#[tauri::command]
pub fn find_fxserver_binary(server_root: String) -> Option<String> {
    let root = PathBuf::from(&server_root);
    for candidate in candidate_paths(&root) {
        if candidate.exists() && candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn start_fxserver(
    app: AppHandle,
    state: State<'_, FxServerState>,
    server_root: String,
    fxserver_path: Option<String>,
    cfg_file: Option<String>,
) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    if inner.child.is_some() {
        return Err("FXServer est déjà en cours d'exécution".to_string());
    }

    let root = PathBuf::from(&server_root);
    if !root.exists() {
        return Err("Le dossier serveur n'existe pas".to_string());
    }

    let binary = fxserver_path
        .map(PathBuf::from)
        .or_else(|| find_fxserver_binary(server_root.clone()).map(PathBuf::from))
        .ok_or_else(|| {
            "FXServer introuvable. Place le binaire dans le dossier serveur ou configure le chemin.".to_string()
        })?;

    let cfg = cfg_file.unwrap_or_else(|| "server.cfg".to_string());
    let cfg_path = root.join(&cfg);
    if !cfg_path.exists() {
        emit_log(
            &app,
            "system",
            format!("Attention: {cfg} introuvable — démarrage sans +exec"),
        );
    }

    let mut command = Command::new(&binary);
    command
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if cfg_path.exists() {
        command.arg("+exec").arg(cfg);
    }
    command.arg("+set").arg("sv_enforceGameBuild").arg("3095");

    emit_log(
        &app,
        "system",
        format!("Démarrage FXServer: {}", binary.display()),
    );

    let mut child = command.spawn().map_err(|error| error.to_string())?;

    if let Some(stdout) = child.stdout.take() {
        spawn_log_reader(app.clone(), "stdout", BufReader::new(stdout));
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_log_reader(app.clone(), "stderr", BufReader::new(stderr));
    }

    inner.child = Some(child);
    inner.server_root = Some(server_root);

    emit_log(&app, "system", "FXServer démarré".to_string());
    let _ = app.emit("server-status", true);
    Ok(())
}

#[tauri::command]
pub fn stop_fxserver(app: AppHandle, state: State<'_, FxServerState>) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = inner.child.take() {
        emit_log(&app, "system", "Arrêt FXServer...".to_string());
        let _ = child.kill();
        let _ = child.wait();
    }
    inner.server_root = None;
    emit_log(&app, "system", "FXServer arrêté".to_string());
    let _ = app.emit("server-status", false);
    Ok(())
}

#[tauri::command]
pub fn send_server_command(state: State<'_, FxServerState>, command: String) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    let child = inner
        .child
        .as_mut()
        .ok_or_else(|| "FXServer n'est pas démarré".to_string())?;

    let stdin = child
        .stdin
        .as_mut()
        .ok_or_else(|| "stdin FXServer indisponible".to_string())?;

    writeln!(stdin, "{command}").map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fxserver_status(state: State<'_, FxServerState>) -> Result<ServerStatus, String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    let running = if let Some(child) = inner.child.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                inner.child = None;
                inner.server_root = None;
                false
            }
            Ok(None) => true,
            Err(_) => false,
        }
    } else {
        false
    };

    Ok(ServerStatus {
        running,
        server_root: inner.server_root.clone(),
        pid: inner.child.as_ref().map(|child| child.id()),
    })
}