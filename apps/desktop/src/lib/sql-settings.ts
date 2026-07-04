export interface SqlProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  database?: string;
}

export interface SqlConnectPayload {
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
}

export interface SqlSettings {
  maxRows: number;
  confirmDestructive: boolean;
}

const PROFILES_KEY = "mdcodev.sql.profiles";
const SETTINGS_KEY = "mdcodev.sql.settings";
const HISTORY_KEY = "mdcodev.sql.history";
const FAVORITES_KEY = "mdcodev.sql.favorites";

const MAX_HISTORY = 50;

export const DEFAULT_SQL_SETTINGS: SqlSettings = {
  maxRows: 500,
  confirmDestructive: true,
};

export function loadSqlProfiles(): SqlProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SqlProfile[];
  } catch {
    return [];
  }
}

export function saveSqlProfiles(profiles: SqlProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function upsertSqlProfile(profile: SqlProfile): SqlProfile[] {
  const profiles = loadSqlProfiles();
  const index = profiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  saveSqlProfiles(profiles);
  return profiles;
}

export function deleteSqlProfile(id: string): SqlProfile[] {
  const profiles = loadSqlProfiles().filter((item) => item.id !== id);
  saveSqlProfiles(profiles);
  return profiles;
}

export function createSqlProfileId(): string {
  return `sql-${Date.now().toString(36)}`;
}

export function loadSqlSettings(): SqlSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SQL_SETTINGS };
    return { ...DEFAULT_SQL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SQL_SETTINGS };
  }
}

export function saveSqlSettings(settings: SqlSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSqlHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function pushSqlHistory(sql: string): string[] {
  const trimmed = sql.trim();
  if (!trimmed) return loadSqlHistory();
  const next = [trimmed, ...loadSqlHistory().filter((entry) => entry !== trimmed)].slice(
    0,
    MAX_HISTORY,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearSqlHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function loadSqlFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveSqlFavorites(favorites: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 30)));
}

export function toggleSqlFavorite(sql: string): string[] {
  const trimmed = sql.trim();
  const favorites = loadSqlFavorites();
  const exists = favorites.includes(trimmed);
  const next = exists
    ? favorites.filter((entry) => entry !== trimmed)
    : [trimmed, ...favorites];
  saveSqlFavorites(next);
  return next;
}

export function isMutatingSql(sql: string): boolean {
  const normalized = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toLowerCase();

  if (!normalized) return false;
  const first = normalized.split(";")[0]?.trim() ?? normalized;
  return (
    /^update\s+/.test(first) ||
    /^insert\s+/.test(first) ||
    /^replace\s+/.test(first) ||
    isDestructiveSql(sql)
  );
}

export function isDestructiveSql(sql: string): boolean {
  const normalized = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toLowerCase();

  if (!normalized) return false;

  const first = normalized.split(";")[0]?.trim() ?? normalized;
  if (/^drop\s+(database|table|schema)\b/.test(first)) return true;
  if (/^truncate\s+table\b/.test(first)) return true;
  if (/^delete\s+from\b/.test(first) && !/\bwhere\b/.test(first)) return true;
  if (/^update\s+\S+\s+set\b/.test(first) && !/\bwhere\b/.test(first)) return true;
  return false;
}