import type { LoadedPlugin } from "@mdcodev/plugin-core";
import styles from "./PluginsPanel.module.css";

interface PluginsPanelProps {
  plugins: LoadedPlugin[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggle: (pluginId: string) => void;
  onRunCommand: (command: string) => void;
}

export function PluginsPanel({
  plugins,
  loading,
  error,
  onRefresh,
  onToggle,
  onRunCommand,
}: PluginsPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>Plugins</h3>
          <p>Charge depuis ~/.mdcodev/plugins et .mdcodev/plugins</p>
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh}>
          ↻
        </button>
      </div>

      {loading && <p className={styles.hint}>Chargement...</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.list}>
        {plugins.length === 0 && !loading && (
          <p className={styles.hint}>
            Ajoute un fichier .json dans ~/.mdcodev/plugins/
          </p>
        )}
        {plugins.map((plugin) => (
          <article key={plugin.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h4>{plugin.name}</h4>
                <p className={styles.version}>v{plugin.version}</p>
              </div>
              <button
                className={plugin.enabled ? styles.toggleOn : styles.toggle}
                onClick={() => onToggle(plugin.id)}
              >
                {plugin.enabled ? "ON" : "OFF"}
              </button>
            </div>
            {plugin.description && <p className={styles.desc}>{plugin.description}</p>}
            <div className={styles.hooks}>
              <span>{plugin.hooks?.lintRules?.length ?? 0} lint</span>
              <span>{plugin.hooks?.completions?.length ?? 0} completions</span>
              <span>{plugin.hooks?.templates?.length ?? 0} templates</span>
            </div>
            {plugin.hooks?.commands?.map((cmd) => (
              <button
                key={cmd.id}
                className={styles.cmdBtn}
                onClick={() => onRunCommand(cmd.command)}
              >
                {cmd.label}
              </button>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}