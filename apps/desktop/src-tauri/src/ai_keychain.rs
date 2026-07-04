use keyring::Entry;

const SERVICE: &str = "mdcodev.ai";

fn entry(provider: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, provider).map_err(|error| format!("Keychain: {error}"))
}

#[tauri::command]
pub fn ai_keychain_save(provider: String, api_key: String) -> Result<(), String> {
    if provider.trim().is_empty() {
        return Err("Provider IA requis".to_string());
    }
    entry(&provider)?
        .set_password(&api_key)
        .map_err(|error| format!("Keychain: {error}"))
}

#[tauri::command]
pub fn ai_keychain_get(provider: String) -> Result<Option<String>, String> {
    if provider.trim().is_empty() {
        return Ok(None);
    }
    match entry(&provider)?.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Keychain: {error}")),
    }
}

#[tauri::command]
pub fn ai_keychain_delete(provider: String) -> Result<(), String> {
    if provider.trim().is_empty() {
        return Ok(());
    }
    match entry(&provider)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Keychain: {error}")),
    }
}