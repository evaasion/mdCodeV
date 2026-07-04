import { useRef, useState } from "react";
import type { ChatMessage } from "../lib/ai";
import { extractLuaBlocks, streamChat } from "../lib/ai";
import type { AiSettings } from "../lib/settings";
import styles from "./AgentPanel.module.css";

interface AgentPanelProps {
  settings: AiSettings;
  activeFileName: string | null;
  activeCode: string;
  onApplyCode: (code: string) => void;
  onOpenSettings: () => void;
}

export function AgentPanel({
  settings,
  activeFileName,
  activeCode,
  onApplyCode,
  onOpenSettings,
}: AgentPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Salut — je suis ton agent FiveM. Décris ta ressource (job, shop, HUD...) et je génère du Lua grounded.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt || streaming) return;

    setError(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    const contextPrefix = activeFileName
      ? `[Fichier actif: ${activeFileName}]\n\`\`\`lua\n${activeCode.slice(0, 4000)}\n\`\`\`\n\n`
      : "";

    const withContext: ChatMessage = {
      ...userMessage,
      content: contextPrefix + prompt,
    };

    const assistantId = crypto.randomUUID();
    const nextMessages = [...messages, { ...userMessage, content: prompt }];
    setMessages([
      ...nextMessages,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    const apiMessages = [
      ...messages.filter((message) => message.id !== "welcome"),
      withContext,
    ];

    try {
      await streamChat(settings, apiMessages, (text) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)),
          );
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Agent IA</h2>
          <p>{settings.model || "Modèle non configuré"}</p>
        </div>
        <button className={styles.settingsBtn} onClick={onOpenSettings}>
          ⚙
        </button>
      </div>

      <div className={styles.messages} ref={listRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? styles.userMsg : styles.assistantMsg}
          >
            <p className={styles.role}>{message.role === "user" ? "Toi" : "mdcodeV"}</p>
            <pre>{message.content}</pre>
            {message.role === "assistant" && message.content && (
              <div className={styles.actions}>
                {extractLuaBlocks(message.content).map((block, index) => (
                  <button
                    key={index}
                    className={styles.applyBtn}
                    onClick={() => onApplyCode(block)}
                  >
                    Appliquer bloc Lua #{index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Crée un job livreur QBCore avec prise de service..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void sendMessage()}
          disabled={streaming || !input.trim()}
        >
          {streaming ? "..." : "Envoyer ⌘↵"}
        </button>
      </div>
    </aside>
  );
}