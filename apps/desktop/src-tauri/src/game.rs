use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "macos")]
fn launch_uri(uri: &str) -> Result<(), String> {
    Command::new("open")
        .arg(uri)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_uri(uri: &str) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", uri])
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn launch_uri(uri: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(uri)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn fivem_candidates(custom_path: Option<String>) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(custom) = custom_path {
        paths.push(PathBuf::from(custom));
    }

    #[cfg(target_os = "macos")]
    {
        paths.push(PathBuf::from("/Applications/FiveM.app"));
        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(home).join("Applications/FiveM.app"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("FiveM/FiveM.exe"));
        }
        paths.push(PathBuf::from("C:/Program Files/FiveM/FiveM.exe"));
    }

    paths
}

#[tauri::command]
pub fn find_fivem_client(custom_path: Option<String>) -> Option<String> {
    for candidate in fivem_candidates(custom_path) {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn launch_fivem_connect(endpoint: String, custom_client_path: Option<String>) -> Result<(), String> {
    let endpoint = endpoint.trim();
    if endpoint.is_empty() {
        return Err("Endpoint vide (ex: 127.0.0.1:30120)".to_string());
    }

    let uri = format!("fivem://connect/{endpoint}");

    if let Some(client_path) = find_fivem_client(custom_client_path) {
        #[cfg(target_os = "macos")]
        {
            if client_path.ends_with(".app") {
                return Command::new("open")
                    .args(["-a", &client_path, "--args", &format!("+connect {endpoint}")])
                    .spawn()
                    .map(|_| ())
                    .map_err(|error| error.to_string());
            }
        }

        #[cfg(target_os = "windows")]
        {
            return Command::new(&client_path)
                .arg(format!("+connect {endpoint}"))
                .spawn()
                .map(|_| ())
                .map_err(|error| error.to_string());
        }
    }

    launch_uri(&uri)
}