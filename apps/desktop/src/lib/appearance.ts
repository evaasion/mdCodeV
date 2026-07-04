export type AppTheme = "dark" | "black";

export interface AppearanceSettings {
  theme: AppTheme;
}

const STORAGE_KEY = "mdcodev.appearance.settings";

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: "dark",
};

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE_SETTINGS };
    return { ...DEFAULT_APPEARANCE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_APPEARANCE_SETTINGS };
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyAppearanceTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = "dark";
}

export function monacoThemeId(theme: AppTheme): string {
  return theme === "black" ? "mdcodev-black" : "mdcodev-dark";
}