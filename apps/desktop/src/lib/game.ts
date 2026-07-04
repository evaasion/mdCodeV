import { invoke } from "@tauri-apps/api/core";

export async function findFiveMClient(customPath?: string): Promise<string | null> {
  return invoke<string | null>("find_fivem_client", {
    customPath: customPath ?? null,
  });
}

export async function launchFiveMConnect(
  endpoint: string,
  customClientPath?: string,
): Promise<void> {
  await invoke("launch_fivem_connect", {
    endpoint,
    customClientPath: customClientPath ?? null,
  });
}