import type { Monaco } from "@monaco-editor/react";
import type { AppTheme } from "./appearance";
import { monacoThemeId } from "./appearance";

const SHARED_RULES = [
  { token: "native", foreground: "f97316", fontStyle: "bold" },
  { token: "export", foreground: "60a5fa", fontStyle: "bold" },
  { token: "comment", foreground: "5c6678", fontStyle: "italic" },
  { token: "keyword", foreground: "c084fc" },
  { token: "string", foreground: "86efac" },
  { token: "number", foreground: "fbbf24" },
];

const THEME_COLORS: Record<AppTheme, Record<string, string>> = {
  dark: {
    "editor.background": "#0d0f12",
    "editor.foreground": "#e8ecf4",
    "editorLineNumber.foreground": "#5c6678",
    "editorLineNumber.activeForeground": "#8b95a8",
    "editor.selectionBackground": "#f9731633",
    "editor.inactiveSelectionBackground": "#f9731622",
    "editorCursor.foreground": "#f97316",
    "editor.lineHighlightBackground": "#13161b",
    "editorGutter.background": "#0d0f12",
    "minimap.background": "#0d0f12",
    "editorWidget.background": "#13161b",
    "editorSuggestWidget.background": "#13161b",
  },
  black: {
    "editor.background": "#000000",
    "editor.foreground": "#d4d4d4",
    "editorLineNumber.foreground": "#404040",
    "editorLineNumber.activeForeground": "#707070",
    "editor.selectionBackground": "#f9731640",
    "editor.inactiveSelectionBackground": "#f9731620",
    "editorCursor.foreground": "#f97316",
    "editor.lineHighlightBackground": "#0a0a0a",
    "editorGutter.background": "#000000",
    "minimap.background": "#000000",
    "editorWidget.background": "#050505",
    "editorSuggestWidget.background": "#050505",
    "scrollbarSlider.background": "#1a1a1a",
    "scrollbarSlider.hoverBackground": "#2a2a2a",
  },
};

let registered = false;

export function registerMonacoThemes(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  for (const theme of ["dark", "black"] as AppTheme[]) {
    monaco.editor.defineTheme(monacoThemeId(theme), {
      base: "vs-dark",
      inherit: true,
      rules: SHARED_RULES,
      colors: THEME_COLORS[theme],
    });
  }
}

export function setMonacoTheme(monaco: Monaco, theme: AppTheme): void {
  registerMonacoThemes(monaco);
  monaco.editor.setTheme(monacoThemeId(theme));
}