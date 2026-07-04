import type { AiSettings } from "./settings";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const FIVEM_SYSTEM_PROMPT = `Tu es l'agent IA de mdcodeV, un IDE spécialisé FiveM / GTA RP.
Règles strictes:
- Génère du Lua FiveM valide uniquement
- N'invente JAMAIS d'exports (ox_lib, QBCore, ESX, qbx_core)
- Utilise les vraies APIs: lib.notify, QBCore.Functions.GetPlayer, exports.ox_inventory, etc.
- Préfère PlayerPedId() à GetPlayerPed(-1)
- Inclus fxmanifest.lua si tu crées une ressource complète
- Réponds en français, code en anglais
- Quand tu proposes du code, utilise des blocs \`\`\`lua`;

function buildSystemPrompt(settings: AiSettings): string {
  const frameworkHints: Record<AiSettings["framework"], string> = {
    qbcore: "Framework: QBCore. Utilise exports['qb-core']:GetCoreObject().",
    qbox: "Framework: Qbox. Utilise exports.qbx_core:GetCoreObject().",
    esx: "Framework: ESX. Utilise exports.es_extended:getSharedObject().",
    standalone: "Framework: standalone. Pas de dépendance framework.",
  };

  return `${FIVEM_SYSTEM_PROMPT}\n${frameworkHints[settings.framework]}`;
}

async function streamOpenAiCompatible(
  settings: AiSettings,
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
        { role: "system", content: buildSystemPrompt(settings) },
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
      system: buildSystemPrompt(settings),
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
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("Configure ta clé API dans les paramètres");
  }

  if (settings.provider === "anthropic") {
    return streamAnthropic(settings, messages, onChunk);
  }

  return streamOpenAiCompatible(settings, messages, onChunk);
}

export function extractLuaBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:lua)?\s*\n([\s\S]*?)```/g;
  for (const match of text.matchAll(re)) {
    if (match[1]?.trim()) blocks.push(match[1].trim());
  }
  return blocks;
}