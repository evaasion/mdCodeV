import { useEffect, useRef, useState } from "react";
import type { ServerLogLine } from "../lib/server";
import styles from "./TerminalPanel.module.css";

interface TerminalPanelProps {
  logs: ServerLogLine[];
  running: boolean;
  fxBinary: string | null;
  error: string | null;
  liveReload: boolean;
  mode: "local" | "remote";
  polling?: boolean;
  onStart: () => void;
  onStop: () => void;
  onCommand: (command: string) => void;
  onClear: () => void;
  onToggleLiveReload: () => void;
  onRefreshLogs?: () => void;
}

export function TerminalPanel({
  logs,
  running,
  fxBinary,
  error,
  liveReload,
  mode,
  polling = false,
  onStart,
  onStop,
  onCommand,
  onClear,
  onToggleLiveReload,
  onRefreshLogs,
}: TerminalPanelProps) {
  const isRemote = mode === "remote";
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [logs]);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.status}>
          <span className={running ? styles.dotOn : styles.dotOff}>●</span>
          {isRemote
            ? running
              ? "Console VPS active"
              : "SSH déconnecté"
            : running
              ? "FXServer actif"
              : "FXServer arrêté"}
          {fxBinary && (
            <span className={styles.binary}>
              {isRemote ? fxBinary.replace("ssh://", "") : fxBinary.split(/[/\\]/).pop()}
            </span>
          )}
          {isRemote && polling && <span className={styles.binary}>logs ●</span>}
        </div>
        <div className={styles.actions}>
          <button
            className={liveReload ? styles.toggleOn : styles.toggle}
            onClick={onToggleLiveReload}
            title="Restart automatique de la ressource à la sauvegarde"
          >
            Live reload {liveReload ? "ON" : "OFF"}
          </button>
          <button className={styles.action} onClick={onClear}>
            Clear
          </button>
          {isRemote && onRefreshLogs && (
            <button className={styles.action} onClick={onRefreshLogs}>
              Refresh logs
            </button>
          )}
          {isRemote ? (
            <button className={`${styles.action} ${styles.start}`} onClick={onStart} disabled={!running}>
              Sync console
            </button>
          ) : running ? (
            <button className={`${styles.action} ${styles.stop}`} onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className={`${styles.action} ${styles.start}`} onClick={onStart}>
              Start FXServer
            </button>
          )}
        </div>
      </div>

      <div className={styles.logs} ref={scrollRef}>
        {logs.length === 0 && (
          <p className={styles.empty}>
            {isRemote
              ? "Configure le chemin de log VPS dans Settings → VPS, puis envoie restart ma-resource."
              : "Démarre FXServer pour voir les logs. Utilise la console pour `restart ma-resource`."}
          </p>
        )}
        {logs.map((line, index) => (
          <div
            key={`${index}-${line.text}`}
            className={
              line.stream === "stderr"
                ? styles.lineErr
                : line.stream === "system"
                  ? styles.lineSystem
                  : styles.line
            }
          >
            {line.text}
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          onCommand(input);
          setInput("");
        }}
      >
        <span className={styles.prompt}>{">"}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={running ? "restart ma-resource" : isRemote ? "Reconnecte SFTP" : "Démarre le serveur d'abord"}
          disabled={!running}
        />
      </form>
    </div>
  );
}