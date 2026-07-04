import type { FrameworkDetection } from "@mdcodev/fivem-project";
import type { ChatMessage } from "./ai";
import { buildSystemPrompt } from "./ai-agent-prompt";
import {
  AI_TOOL_DEFINITIONS,
  ANTHROPIC_TOOL_DEFINITIONS,
  executeAiTool,
  type AiToolHandlers,
} from "./ai-tools";
import type { AiSettings } from "./settings";

const MAX_TOOL_ROUNDS = 8;

export interface ApiMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAiToolCall[];
}

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AgentRunCallbacks {
  onChunk: (text: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolEnd?: (name: string, result: string) => void;
}

function toApiMessages(messages: ChatMessage[]): ApiMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function openAiCompletion(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ApiMessage[],
  withTools: boolean,
): Promise<ApiMessage> {
  const body: Record<string, unknown> = {
    model: settings.model,
    stream: false,
    messages: [
      { role: "system", content: buildSystemPrompt(settings, frameworkDetection) },
      ...messages,
    ],
    temperature: 0.2,
  };

  if (withTools) {
    body.tools = AI_TOOL_DEFINITIONS;
    body.tool_choice = "auto";
  }

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error("Réponse API vide");
  return message as ApiMessage;
}

async function anthropicCompletion(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ApiMessage[],
  withTools: boolean,
): Promise<{ content: AnthropicBlock[]; stop_reason: string }> {
  const anthropicMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      if (message.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result",
              tool_use_id: message.tool_call_id,
              content: message.content,
            },
          ],
        };
      }

      if (message.tool_calls?.length) {
        return {
          role: "assistant" as const,
          content: message.tool_calls.map((call) => ({
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input: parseToolArgs(call.function.arguments),
          })),
        };
      }

      return {
        role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: message.content,
      };
    });

  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: 4096,
    stream: false,
    system: buildSystemPrompt(settings, frameworkDetection),
    messages: anthropicMessages,
  };

  if (withTools) {
    body.tools = ANTHROPIC_TOOL_DEFINITIONS;
  }

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${err}`);
  }

  return response.json();
}

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

function anthropicToApiMessage(payload: {
  content: AnthropicBlock[];
  stop_reason: string;
}): ApiMessage {
  const text = payload.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");

  const toolUses = payload.content.filter(
    (block): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      block.type === "tool_use",
  );

  if (toolUses.length === 0) {
    return { role: "assistant", content: text };
  }

  return {
    role: "assistant",
    content: text,
    tool_calls: toolUses.map((tool) => ({
      id: tool.id,
      type: "function" as const,
      function: {
        name: tool.name,
        arguments: JSON.stringify(tool.input),
      },
    })),
  };
}

async function streamFinalOpenAi(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ApiMessage[],
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
        ...messages,
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
        // ignore
      }
    }
  }

  return full;
}

async function streamFinalAnthropic(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ApiMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const anthropicMessages = messages
    .filter((message) => message.role !== "system" && message.role !== "tool")
    .map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));

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
      messages: anthropicMessages,
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

async function runToolLoop(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  initialMessages: ApiMessage[],
  handlers: AiToolHandlers,
  callbacks: AgentRunCallbacks,
): Promise<ApiMessage[]> {
  const messages = [...initialMessages];
  let prefix = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion =
      settings.provider === "anthropic"
        ? anthropicToApiMessage(
            await anthropicCompletion(settings, frameworkDetection, messages, true),
          )
        : await openAiCompletion(settings, frameworkDetection, messages, true);

    if (!completion.tool_calls?.length) {
      messages.push(completion);
      return messages;
    }

    messages.push(completion);

    for (const call of completion.tool_calls) {
      const args = parseToolArgs(call.function.arguments);
      callbacks.onToolStart?.(call.function.name, args);
      prefix += `🔧 ${call.function.name}\n`;
      callbacks.onChunk(prefix);

      const result = await executeAiTool(call.function.name, args, handlers);
      callbacks.onToolEnd?.(call.function.name, result);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: result,
      });
    }
  }

  throw new Error("Trop d'appels d'outils (limite atteinte)");
}

export async function runAgentChat(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
  messages: ChatMessage[],
  handlers: AiToolHandlers,
  callbacks: AgentRunCallbacks,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("Configure ta clé API dans les paramètres");
  }

  const apiMessages = toApiMessages(messages);
  const afterTools = await runToolLoop(
    settings,
    frameworkDetection,
    apiMessages,
    handlers,
    callbacks,
  );

  const last = afterTools[afterTools.length - 1];
  if (last?.role === "assistant" && last.content && !last.tool_calls?.length) {
    callbacks.onChunk(last.content);
    return last.content;
  }

  if (settings.provider === "anthropic") {
    return streamFinalAnthropic(settings, frameworkDetection, afterTools, callbacks.onChunk);
  }

  return streamFinalOpenAi(settings, frameworkDetection, afterTools, callbacks.onChunk);
}