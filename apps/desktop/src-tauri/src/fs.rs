use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

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

fn is_ignored(name: &str) -> bool {
    IGNORED_DIRS.contains(&name) || name.starts_with('.')
}

fn is_likely_text(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "lua" | "js" | "ts" | "json" | "xml" | "html" | "css" | "md" | "txt" | "cfg" | "yml" | "yaml" | "toml"
        ),
        None => path.file_name().and_then(|n| n.to_str()) == Some("fxmanifest.lua")
            || path.file_name().and_then(|n| n.to_str()) == Some("server.cfg"),
    }
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&path, content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileNode>, String> {
    build_tree(Path::new(&path), 1)
}

#[tauri::command]
pub fn list_project_tree(path: String) -> Result<Vec<FileNode>, String> {
    build_tree(Path::new(&path), 1)
}

fn build_tree(path: &Path, max_depth: u8) -> Result<Vec<FileNode>, String> {
    if max_depth == 0 {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(path).map_err(|error| error.to_string())?;
    let mut nodes = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        if is_ignored(&name) {
            continue;
        }

        let is_dir = file_type.is_dir();
        if !is_dir && !is_likely_text(&entry_path) {
            continue;
        }

        let children = if is_dir && max_depth > 1 {
            Some(build_tree(&entry_path, max_depth - 1)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

#[tauri::command]
pub fn detect_project(root_path: String) -> Result<ProjectInfo, String> {
    let root = PathBuf::from(&root_path);
    if !root.exists() {
        return Err("Le dossier n'existe pas".to_string());
    }

    let manifest_path = find_manifest(&root);
    let server_cfg_path = find_server_cfg(&root);
    let resources = find_resources(&root);

    let project_type = if manifest_path.is_some() {
        "resource".to_string()
    } else if server_cfg_path.is_some() || !resources.is_empty() {
        "server".to_string()
    } else {
        "unknown".to_string()
    };

    Ok(ProjectInfo {
        root_path,
        project_type,
        manifest_path,
        server_cfg_path,
        resources,
    })
}

fn find_manifest(root: &Path) -> Option<String> {
    let direct = root.join("fxmanifest.lua");
    if direct.exists() {
        return Some(direct.to_string_lossy().to_string());
    }

    if root.file_name().and_then(|n| n.to_str()) == Some("resources") {
        return None;
    }

    for entry in fs::read_dir(root).ok()? {
        let entry = entry.ok()?;
        if !entry.file_type().ok()?.is_dir() {
            continue;
        }
        let child = entry.path().join("fxmanifest.lua");
        if child.exists() {
            return Some(child.to_string_lossy().to_string());
        }
    }

    None
}

fn find_server_cfg(root: &Path) -> Option<String> {
    let direct = root.join("server.cfg");
    if direct.exists() {
        return Some(direct.to_string_lossy().to_string());
    }
    None
}

fn find_resources(root: &Path) -> Vec<String> {
    let resources_dir = root.join("resources");
    if !resources_dir.exists() {
        return vec![];
    }

    let mut resources = Vec::new();
    if let Ok(entries) = fs::read_dir(&resources_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                resources.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }

    resources.sort();
    resources
}

#[tauri::command]
pub fn write_scaffold(
    root_path: String,
    resource_name: String,
    files: std::collections::HashMap<String, String>,
) -> Result<Vec<String>, String> {
    let resource_dir = Path::new(&root_path).join(&resource_name);
    fs::create_dir_all(&resource_dir).map_err(|error| error.to_string())?;

    let mut written = Vec::new();
    for (relative, content) in files {
        let file_path = resource_dir.join(&relative);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&file_path, content).map_err(|error| error.to_string())?;
        written.push(file_path.to_string_lossy().to_string());
    }

    Ok(written)
}