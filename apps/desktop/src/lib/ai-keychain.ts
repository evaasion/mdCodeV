import { invoke } from "@tauri-apps/api/core";
import type { AiProvider } from "./settings";

export async function saveAiKeychainKey(provider: AiProvider, apiKey: string): Promise<void> {
  await invoke("ai_keychain_save", { provider, apiKey });
}

export async function getAiKeychainKey(provider: AiProvider): Promise<string | null> {
  return invoke<string | null>("ai_keychain_get", { provider });
}

export async function deleteAiKeychainKey(provider: AiProvider): Promise<void> {
  await invoke("ai_keychain_delete", { provider });
}