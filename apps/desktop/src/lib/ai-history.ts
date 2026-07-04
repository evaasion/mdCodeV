import type { ChatMessage } from "./ai";

const STORAGE_KEY = "mdcodev.ai.history";
const MAX_MESSAGES = 40;
const GLOBAL_KEY = "__global__";

interface HistoryStore {
  [projectKey: string]: ChatMessage[];
}

function readStore(): HistoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as HistoryStore;
  } catch {
    return {};
  }
}

function writeStore(store: HistoryStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function projectHistoryKey(rootPath?: string | null): string {
  return rootPath?.trim() || GLOBAL_KEY;
}

export function loadAiHistory(projectKey: string): ChatMessage[] {
  return readStore()[projectKey] ?? [];
}

export function saveAiHistory(projectKey: string, messages: ChatMessage[]): void {
  const store = readStore();
  const persisted = messages
    .filter((message) => message.id !== "welcome")
    .slice(-MAX_MESSAGES);
  if (persisted.length === 0) {
    delete store[projectKey];
  } else {
    store[projectKey] = persisted;
  }
  writeStore(store);
}

export function clearAiHistory(projectKey: string): void {
  const store = readStore();
  delete store[projectKey];
  writeStore(store);
}