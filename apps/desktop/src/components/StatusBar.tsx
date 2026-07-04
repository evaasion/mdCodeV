import type { NativeFunction } from "@mdcodev/natives-core";
import type { FrameworkDetection } from "@mdcodev/fivem-project";
import { isRemoteProject } from "../lib/project-fs";
import type { ProjectInfo } from "../lib/tauri-fs";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  nativeCount: number;
  namespaceCount: number;
  fileName: string;
  selectedNative: NativeFunction | null;
  project: ProjectInfo | null;
  framework: FrameworkDetection | null;
  serverRunning: boolean;
  platformLabel: string;
  resourceSummary: { running: number; stopped: number };
  diagnostics: { error: number; warning: number; info: number };
  saveState: string | null;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  qbcore: "QBCore",
  qbox: "Qbox",
  esx: "ESX",
  standalone: "Standalone",
};

export function StatusBar({
  nativeCount,
  namespaceCount,
  fileName,
  selectedNative,
  project,
  framework,
  serverRunning,
  platformLabel,
  resourceSummary,
  diagnostics,
  saveState,
}: StatusBarProps) {
  return (
    <footer className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.item}>FiveM Lua</span>
        <span className={styles.sep}>|</span>
        <span className={styles.item}>{fileName}</span>
        {framework && (
          <>
            <span className={styles.sep}>|</span>
            <span className={styles.item}>
              {FRAMEWORK_LABELS[framework.framework] ?? framework.framework}
              {framework.usesOxLib ? " + ox_lib" : ""}
            </span>
          </>
        )}
      </div>
      <div className={styles.center}>
        {saveState ? (
          <span>{saveState}</span>
        ) : selectedNative ? (
          <span className={styles.native}>
            {selectedNative.luaName}
            <span className={styles.muted}> · {selectedNative.namespace}</span>
          </span>
        ) : diagnostics.error + diagnostics.warning > 0 ? (
          <span className={styles.muted}>
            {diagnostics.error} erreurs · {diagnostics.warning} warnings
          </span>
        ) : isRemoteProject(project) ? (
          <span className={styles.muted}>
            {serverRunning
              ? "VPS · ⌘S upload + live reload SSH"
              : "VPS · reconnecte SFTP pour la console distante"}
          </span>
        ) : (
          <span className={styles.muted}>
            {serverRunning ? "FXServer actif · live reload ON" : "⌘S save · Terminal pour FXServer"}
          </span>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.item}>{nativeCount.toLocaleString()} natives</span>
        <span className={styles.sep}>|</span>
        <span className={styles.item}>{namespaceCount} ns</span>
        <span className={styles.sep}>|</span>
        <span className={styles.item}>{platformLabel}</span>
        <span className={styles.sep}>|</span>
        <span className={serverRunning ? styles.serverOn : styles.ready}>
          {serverRunning
            ? `● ${resourceSummary.running} res`
            : "○ Server"}
        </span>
      </div>
    </footer>
  );
}