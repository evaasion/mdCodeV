import type { FrameworkDetection } from "@mdcodev/fivem-project";
import { buildSystemPrompt } from "./ai-agent-prompt";
import type { AiSettings } from "./settings";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldBundle {
  resourceName: string;
  files: Record<string, string>;
}

async function streamOpenAiCompatible(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(settings, frameworkDetection) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming non supporté");

  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onChunk(full);
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  return full;
}

async function streamAnthropic(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 4096,
      stream: true,
      system: buildSystemPrompt(settings, frameworkDetection),
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming non supporté");

  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        if (json.type === "content_block_delta") {
          const delta = json.delta?.text ?? "";
          if (delta) {
            full += delta;
            onChunk(full);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return full;
}

export async function streamChat(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("Configure ta clé API dans les paramètres");
  }

  if (settings.provider === "anthropic") {
    return streamAnthropic(settings, frameworkDetection, messages, onChunk);
  }

  return streamOpenAiCompatible(settings, frameworkDetection, messages, onChunk);
}

export function extractLuaBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:lua)?(?!\s*path=)\s*\n([\s\S]*?)```/g;
  for (const match of text.matchAll(re)) {
    if (match[1]?.trim()) blocks.push(match[1].trim());
  }
  return blocks;
}

export function extractScaffoldFiles(text: string): ScaffoldFile[] {
  const files: ScaffoldFile[] = [];
  const re = /```(?:lua)?\s*path=([^\n]+)\n([\s\S]*?)```/g;
  for (const match of text.matchAll(re)) {
    const path = match[1]?.trim();
    const content = match[2]?.trim();
    if (path && content) {
      files.push({ path, content });
    }
  }
  return files;
}

export function parseScaffoldBundle(files: ScaffoldFile[]): ScaffoldBundle | null {
  if (files.length === 0) return null;

  const resourceName = files[0].path.split("/")[0]?.trim();
  if (!resourceName) return null;

  const bundle: Record<string, string> = {};
  for (const file of files) {
    const normalized = file.path.replace(/\\/g, "/");
    const relative = normalized.startsWith(`${resourceName}/`)
      ? normalized.slice(resourceName.length + 1)
      : normalized;
    bundle[relative] = file.content;
  }

  return { resourceName, files: bundle };
}