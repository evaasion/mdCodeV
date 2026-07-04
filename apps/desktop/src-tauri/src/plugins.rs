use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFile {
    pub path: String,
    pub name: String,
}

fn plugin_dirs(project_path: Option<String>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(home) = std::env::var("HOME") {
        dirs.push(PathBuf::from(home).join(".mdcodev").join("plugins"));
    }

    if let Some(project) = project_path {
        dirs.push(PathBuf::from(project).join(".mdcodev").join("plugins"));
    }

    dirs
}

#[tauri::command]
pub fn list_plugin_files(project_path: Option<String>) -> Result<Vec<PluginFile>, String> {
    let mut files = Vec::new();

    for dir in plugin_dirs(project_path) {
        if !dir.exists() {
            continue;
        }

        let entries = fs::read_dir(&dir).map_err(|error| error.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("plugin.json")
                .to_string();

            if file_name.ends_with(".json") {
                files.push(PluginFile {
                    path: path.to_string_lossy().to_string(),
                    name: file_name,
                });
            }
        }
    }

    Ok(files)
}

#[tauri::command]
pub fn read_plugin_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn ensure_plugins_dir(project_path: Option<String>) -> Result<Vec<String>, String> {
    let mut created = Vec::new();

    for dir in plugin_dirs(project_path) {
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
            created.push(dir.to_string_lossy().to_string());
        }
    }

    Ok(created)
}