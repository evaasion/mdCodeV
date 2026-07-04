export type AiProvider = "openai" | "anthropic" | "openai-compatible";

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  framework: "qbcore" | "qbox" | "esx" | "standalone";
}

const STORAGE_KEY = "mdcodev.ai.settings";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openai-compatible",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  framework: "qbcore",
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export type GamePlatform = "fivem" | "gta6";

export interface ServerSettings {
  fxServerPath: string;
  cfgFile: string;
  liveReload: boolean;
  serverEndpoint: string;
  fivemClientPath: string;
}

export interface PlatformSettings {
  platform: GamePlatform;
  gta6Preview: boolean;
}

export interface CloudSettings {
  catalogUrl: string;
  autoSyncOnStart: boolean;
}

export interface PluginSettings {
  loadProjectPlugins: boolean;
  loadGlobalPlugins: boolean;
}

export type RemoteConsolePreset = "screen" | "tmux" | "raw" | "custom";

export interface RemoteServerSettings {
  liveReload: boolean;
  pollLogs: boolean;
  logPollIntervalSec: number;
  logFilePath: string;
  consolePreset: RemoteConsolePreset;
  consoleCommandTemplate: string;
  screenSessionName: string;
  tmuxSessionName: string;
}

const SERVER_STORAGE_KEY = "mdcodev.server.settings";

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  fxServerPath: "",
  cfgFile: "server.cfg",
  liveReload: true,
  serverEndpoint: "127.0.0.1:30120",
  fivemClientPath: "",
};

const PLATFORM_STORAGE_KEY = "mdcodev.platform.settings";

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform: "fivem",
  gta6Preview: false,
};

export function loadPlatformSettings(): PlatformSettings {
  try {
    const raw = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLATFORM_SETTINGS };
    return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }
}

export function savePlatformSettings(settings: PlatformSettings): void {
  localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(settings));
}

const CLOUD_STORAGE_KEY = "mdcodev.cloud.settings";
const PLUGIN_STORAGE_KEY = "mdcodev.plugin.settings";
const REMOTE_SERVER_STORAGE_KEY = "mdcodev.remote.server.settings";

export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  catalogUrl: "bundled",
  autoSyncOnStart: true,
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  loadProjectPlugins: true,
  loadGlobalPlugins: true,
};

export const DEFAULT_REMOTE_SERVER_SETTINGS: RemoteServerSettings = {
  liveReload: true,
  pollLogs: true,
  logPollIntervalSec: 4,
  logFilePath: "",
  consolePreset: "screen",
  consoleCommandTemplate:
    "screen -S {session} -p 0 -X stuff \"{command}\\n\"",
  screenSessionName: "fivem",
  tmuxSessionName: "fivem",
};

export function loadCloudSettings(): CloudSettings {
  try {
    const raw = localStorage.getItem(CLOUD_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CLOUD_SETTINGS };
    return { ...DEFAULT_CLOUD_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CLOUD_SETTINGS };
  }
}

export function saveCloudSettings(settings: CloudSettings): void {
  localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(settings));
}

export function loadPluginSettings(): PluginSettings {
  try {
    const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLUGIN_SETTINGS };
    return { ...DEFAULT_PLUGIN_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PLUGIN_SETTINGS };
  }
}

export function savePluginSettings(settings: PluginSettings): void {
  localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(settings));
}

export function loadServerSettings(): ServerSettings {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SERVER_SETTINGS };
    return { ...DEFAULT_SERVER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SERVER_SETTINGS };
  }
}

export function saveServerSettings(settings: ServerSettings): void {
  localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(settings));
}

export function loadRemoteServerSettings(): RemoteServerSettings {
  try {
    const raw = localStorage.getItem(REMOTE_SERVER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REMOTE_SERVER_SETTINGS };
    return { ...DEFAULT_REMOTE_SERVER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_REMOTE_SERVER_SETTINGS };
  }
}

export function saveRemoteServerSettings(settings: RemoteServerSettings): void {
  localStorage.setItem(REMOTE_SERVER_STORAGE_KEY, JSON.stringify(settings));
}

export function buildRemoteConsoleTemplate(settings: RemoteServerSettings): string {
  switch (settings.consolePreset) {
    case "screen":
      return `screen -S ${settings.screenSessionName} -p 0 -X stuff "{command}\\n"`;
    case "tmux":
      return `tmux send-keys -t ${settings.tmuxSessionName} "{command}" Enter`;
    case "raw":
      return "{command}";
    case "custom":
    default:
      return settings.consoleCommandTemplate;
  }
}

export function providerPresets(provider: AiProvider): Partial<AiSettings> {
  switch (provider) {
    case "openai":
      return { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" };
    case "anthropic":
      return { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" };
    case "openai-compatible":
      return { baseUrl: "https://api.x.ai/v1", model: "grok-2-latest" };
    default:
      return {};
  }
}