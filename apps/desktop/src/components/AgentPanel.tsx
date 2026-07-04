import { useEffect, useRef, useState } from "react";
import type { FrameworkDetection } from "@mdcodev/fivem-project";
import type { LintDiagnostic } from "@mdcodev/linter-core";
import type { ExportCompletion } from "@mdcodev/fivem-project";
import { runAgentChat } from "../lib/ai-agent";
import {
  extractLuaBlocks,
  extractScaffoldFiles,
  parseScaffoldBundle,
  streamChat,
  type ChatMessage,
} from "../lib/ai";
import { AI_QUICK_PROMPTS } from "../lib/ai-quick-prompts";
import type { AiToolHandlers } from "../lib/ai-tools";
import {
  buildAiContextMessage,
  resolveAiFramework,
  type EditorSelectionContext,
} from "../lib/ai-context";
import { clearAiHistory, loadAiHistory, projectHistoryKey, saveAiHistory } from "../lib/ai-history";
import type { FileNode, ProjectInfo } from "../lib/tauri-fs";
import type { AiSettings } from "../lib/settings";
import styles from "./AgentPanel.module.css";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Salut — agent FiveM avec outils IDE (fichiers, SQL, console serveur). Je vois ton projet et tes erreurs linter.",
};

interface AgentPanelProps {
  settings: AiSettings;
  project: ProjectInfo | null;
  framework: FrameworkDetection | null;
  tree: FileNode[];
  diagnostics: LintDiagnostic[];
  exportCompletions: ExportCompletion[];
  activeFileName: string | null;
  activeCode: string;
  selection: EditorSelectionContext | null;
  onApplyCode: (code: string, mode: "append" | "replace") => void;
  onScaffoldResource: (resourceName: string, files: Record<string, string>) => Promise<void>;
  toolHandlers: AiToolHandlers;
  onOpenSettings: () => void;
}

export function AgentPanel({
  settings,
  project,
  framework,
  tree,
  diagnostics,
  exportCompletions,
  activeFileName,
  activeCode,
  selection,
  onApplyCode,
  onScaffoldResource,
  toolHandlers,
  onOpenSettings,
}: AgentPanelProps) {
  const historyKey = projectHistoryKey(project?.rootPath);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadAiHistory(historyKey);
    return saved.length > 0 ? saved : [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadAiHistory(historyKey);
    setMessages(saved.length > 0 ? saved : [WELCOME_MESSAGE]);
  }, [historyKey]);

  useEffect(() => {
    saveAiHistory(historyKey, messages);
  }, [historyKey, messages]);

  const activeFramework = resolveAiFramework(settings, framework);

  const quickContext = {
    activeFileName,
    selectionText: selection?.text ?? null,
    diagnostics,
  };

  async function runPrompt(prompt: string) {
    if (!prompt.trim() || streaming) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    const contextMessage = await buildAiContextMessage(settings, {
      project,
      framework,
      tree,
      diagnostics,
      exportCompletions,
      activeFileName,
      activeCode,
      selection,
    });

    const withContext: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `${contextMessage}\n\n[Demande]\n${prompt}`,
    };

    const previous = messages.filter((message) => message.id !== "welcome");
    const assistantId = crypto.randomUUID();
    const nextMessages = [...previous, userMessage];
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const apiMessages = [...previous, withContext];

    try {
      const run = settings.enableTools
        ? (onChunk: (text: string) => void) =>
            runAgentChat(settings, framework, apiMessages, toolHandlers, { onChunk })
        : (onChunk: (text: string) => void) =>
            streamChat(settings, framework, apiMessages, onChunk);

      await run((text) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: text } : message,
          ),
        );
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt) return;
    setInput("");
    await runPrompt(prompt);
  }

  function handleClearHistory() {
    clearAiHistory(historyKey);
    setMessages([WELCOME_MESSAGE]);
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Agent IA</h2>
          <p>
            {settings.model || "Modèle non configuré"} · {activeFramework}
            {framework && settings.useAutoFramework ? ` (${framework.confidence})` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={handleClearHistory} title="Effacer l'historique">
            🗑
          </button>
          <button className={styles.settingsBtn} onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      <div className={styles.contextBar}>
        {project ? (
          <span>{project.rootPath.split(/[/\\]/).filter(Boolean).pop()}</span>
        ) : (
          <span>Aucun projet — contexte limité</span>
        )}
        {activeFileName && <span>· {activeFileName}</span>}
        {selection?.text.trim() && <span>· sélection</span>}
        {diagnostics.length > 0 && <span>· {diagnostics.length} diag.</span>}
        {settings.enableTools && <span>· outils actifs</span>}
      </div>

      <div className={styles.quickBar}>
        {AI_QUICK_PROMPTS.map((quick) => {
          const prompt = quick.build(quickContext);
          return (
            <button
              key={quick.id}
              className={styles.quickBtn}
              disabled={streaming || !prompt}
              title={prompt ?? "Contexte requis"}
              onClick={() => void runPrompt(prompt!)}
            >
              {quick.label}
            </button>
          );
        })}
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
                  <div key={`lua-${index}`} className={styles.actionRow}>
                    <button
                      className={styles.applyBtn}
                      onClick={() => onApplyCode(block, "append")}
                    >
                      Insérer #{index + 1}
                    </button>
                    <button
                      className={styles.replaceBtn}
                      onClick={() => onApplyCode(block, "replace")}
                      disabled={!selection?.text.trim()}
                      title={selection?.text.trim() ? "Remplacer la sélection" : "Sélectionne du code"}
                    >
                      Remplacer #{index + 1}
                    </button>
                  </div>
                ))}
                {(() => {
                  const bundle = parseScaffoldBundle(extractScaffoldFiles(message.content));
                  if (!bundle) return null;
                  return (
                    <button
                      className={styles.scaffoldBtn}
                      onClick={() => void onScaffoldResource(bundle.resourceName, bundle.files)}
                    >
                      Créer ressource · {bundle.resourceName} ({Object.keys(bundle.files).length}{" "}
                      fichiers)
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ex: Corrige les erreurs linter, crée un job livreur QBCore..."
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
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