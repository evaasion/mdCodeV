import type { ResourceMetric } from "@mdcodev/fivem-project";
import styles from "./ResourceMonitorPanel.module.css";

interface ResourceMonitorPanelProps {
  metrics: ResourceMetric[];
  summary: { running: number; stopped: number; starting: number; error: number };
  onRestart: (name: string) => void;
  onRefreshResmon: () => void;
  serverRunning: boolean;
}

const STATE_LABEL: Record<ResourceMetric["state"], string> = {
  running: "Actif",
  stopped: "Arrêté",
  starting: "Démarrage",
  error: "Erreur",
};

export function ResourceMonitorPanel({
  metrics,
  summary,
  onRestart,
  onRefreshResmon,
  serverRunning,
}: ResourceMonitorPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <span className={styles.statOk}>{summary.running} actives</span>
          <span className={styles.statMuted}>{summary.stopped} arrêtées</span>
          {summary.error > 0 && <span className={styles.statErr}>{summary.error} erreurs</span>}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={onRefreshResmon}
          disabled={!serverRunning}
        >
          Resmon
        </button>
      </div>

      <div className={styles.list}>
        {metrics.length === 0 && (
          <p className={styles.empty}>
            Ouvre un serveur et démarre FXServer pour monitorer les resources.
          </p>
        )}
        {metrics.map((metric) => (
          <div key={metric.name} className={styles.row}>
            <div className={styles.rowMain}>
              <span className={`${styles.dot} ${styles[metric.state]}`}>●</span>
              <span className={styles.name}>{metric.name}</span>
              <span className={`${styles.state} ${styles[metric.state]}`}>
                {STATE_LABEL[metric.state]}
              </span>
            </div>
            <button
              className={styles.restartBtn}
              onClick={() => onRestart(metric.name)}
              disabled={!serverRunning}
            >
              restart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}