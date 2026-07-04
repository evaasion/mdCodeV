export interface EditorTab {
  id: string;
  path: string | null;
  fileName: string;
  content: string;
  originalContent: string;
  language: string;
}

export function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function languageFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "lua":
      return "fivem-lua";
    case "js":
    case "ts":
      return "javascript";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sql":
      return "mysql";
    case "cfg":
    case "txt":
    case "md":
      return "plaintext";
    default:
      return "fivem-lua";
  }
}

export function createUntitledTab(content: string, fileName = "untitled.lua"): EditorTab {
  return {
    id: crypto.randomUUID(),
    path: null,
    fileName,
    content,
    originalContent: content,
    language: languageFromFileName(fileName),
  };
}

export function createTabFromFile(path: string, content: string): EditorTab {
  const fileName = fileNameFromPath(path);
  return {
    id: path,
    path,
    fileName,
    content,
    originalContent: content,
    language: languageFromFileName(fileName),
  };
}

export function isTabDirty(tab: EditorTab): boolean {
  return tab.content !== tab.originalContent;
}