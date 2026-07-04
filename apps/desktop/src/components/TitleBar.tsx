import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import styles from "./TitleBar.module.css";

interface TitleBarProps {
  fileName: string;
  projectName: string | null;
  isRemoteProject: boolean;
  onOpenProject: () => void;
  onOpenRemote: () => void;
  onOpenSql: () => void;
  sqlConnected: boolean;
  onToggleAgent: () => void;
  onOpenSettings: () => void;
  onToggleTerminal: () => void;
  onPlay: () => void;
  onNewResource: () => void;
  canScaffold: boolean;
  canPlay: boolean;
  serverRunning: boolean;
  platformLabel: string;
}

export function TitleBar({
  fileName,
  projectName,
  isRemoteProject,
  onOpenProject,
  onOpenRemote,
  onOpenSql,
  sqlConnected,
  onToggleAgent,
  onOpenSettings,
  onToggleTerminal,
  onPlay,
  onNewResource,
  canScaffold,
  canPlay,
  serverRunning,
  platformLabel,
}: TitleBarProps) {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    void appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      void appWindow.isMaximized().then(setIsMaximized);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  async function handleMinimize() {
    await appWindow.minimize();
  }

  async function handleToggleMaximize() {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  }

  async function handleClose() {
    await appWindow.close();
  }

  return (
    <header className={styles.bar}>
      <div className={styles.brand} data-tauri-drag-region>
        <span className={styles.logo}>V</span>
        <span className={styles.name}>mdcodeV</span>
        <span className={styles.badge}>Phase 6</span>
        <span className={styles.platform}>{platformLabel}</span>
      </div>

      <div className={styles.actions} data-tauri-drag-region>
        <button className={styles.actionBtn} onClick={onOpenProject}>
          Ouvrir ⌘O
        </button>
        <button className={styles.actionBtn} onClick={onOpenRemote}>
          SFTP
        </button>
        <button className={styles.actionBtn} onClick={onOpenSql}>
          MySQL{sqlConnected ? " ●" : ""}
        </button>
        <button className={styles.actionBtn} onClick={onPlay} disabled={!canPlay}>
          ▶ Jouer
        </button>
        <button
          className={styles.actionBtn}
          onClick={onNewResource}
          disabled={!canScaffold}
        >
          + Ressource
        </button>
        <button className={styles.actionBtn} onClick={onToggleTerminal}>
          Terminal{serverRunning ? " ●" : ""}
        </button>
        <button className={styles.actionBtn} onClick={onToggleAgent}>
          Agent IA
        </button>
        <button className={styles.actionBtn} onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      <div className={styles.file} data-tauri-drag-region>
        {isRemoteProject && <span className={styles.remoteTag}>SFTP</span>}
        {projectName ? `${projectName} / ` : ""}
        {fileName}
      </div>

      <div className={styles.controls}>
        <button
          className={styles.control}
          onClick={() => void handleMinimize()}
          aria-label="Minimize"
        >
          ─
        </button>
        <button
          className={styles.control}
          onClick={() => void handleToggleMaximize()}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? "❐" : "□"}
        </button>
        <button
          className={`${styles.control} ${styles.close}`}
          onClick={() => void handleClose()}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </header>
  );
}