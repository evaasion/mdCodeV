use keyring::Entry;

const SERVICE: &str = "mdcodev.sql";

fn entry(profile_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, profile_id).map_err(|error| format!("Keychain: {error}"))
}

#[tauri::command]
pub fn sql_keychain_save(profile_id: String, password: String) -> Result<(), String> {
    if profile_id.trim().is_empty() {
        return Err("Profil SQL requis".to_string());
    }
    entry(&profile_id)?.set_password(&password).map_err(|error| format!("Keychain: {error}"))
}

#[tauri::command]
pub fn sql_keychain_get(profile_id: String) -> Result<Option<String>, String> {
    if profile_id.trim().is_empty() {
        return Ok(None);
    }
    match entry(&profile_id)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Keychain: {error}")),
    }
}

#[tauri::command]
pub fn sql_keychain_delete(profile_id: String) -> Result<(), String> {
    if profile_id.trim().is_empty() {
        return Ok(());
    }
    match entry(&profile_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Keychain: {error}")),
    }
}