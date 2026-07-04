export type RemoteAuthType = "password" | "privateKey";

export interface RemoteProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: RemoteAuthType;
  privateKeyPath?: string;
  defaultPath?: string;
}

export interface SftpConnectPayload {
  host: string;
  port: number;
  username: string;
  authType: RemoteAuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

const PROFILES_KEY = "mdcodev.remote.profiles";

export function loadRemoteProfiles(): RemoteProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RemoteProfile[];
  } catch {
    return [];
  }
}

export function saveRemoteProfiles(profiles: RemoteProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function upsertRemoteProfile(profile: RemoteProfile): RemoteProfile[] {
  const profiles = loadRemoteProfiles();
  const index = profiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  saveRemoteProfiles(profiles);
  return profiles;
}

export function deleteRemoteProfile(id: string): RemoteProfile[] {
  const profiles = loadRemoteProfiles().filter((item) => item.id !== id);
  saveRemoteProfiles(profiles);
  return profiles;
}

export function createProfileId(): string {
  return `remote-${Date.now().toString(36)}`;
}