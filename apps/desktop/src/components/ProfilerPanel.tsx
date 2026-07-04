import type { ProfilerSnapshot, ResourceProfile } from "@mdcodev/fivem-project";
import styles from "./ProfilerPanel.module.css";

interface ProfilerPanelProps {
  snapshot: ProfilerSnapshot;
  history: ProfilerSnapshot[];
  health: "good" | "warn" | "critical";
  topConsumers: ResourceProfile[];
  onRefresh: () => void;
  serverRunning: boolean;
}

const HEALTH_LABEL = {
  good: "Sain",
  warn: "Attention",
  critical: "Critique",
} as const;

export function ProfilerPanel({
  snapshot,
  history,
  health,
  topConsumers,
  onRefresh,
  serverRunning,
}: ProfilerPanelProps) {
  const maxScore = Math.max(...topConsumers.map((r) => r.cpuScore), 1);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.summary}>
          <span className={`${styles.health} ${styles[health]}`}>
            {HEALTH_LABEL[health]}
          </span>
          <span className={styles.meta}>
            {snapshot.totalMemoryMb.toFixed(1)} MiB total
          </span>
          {snapshot.serverHitchMs > 0 && (
            <span className={styles.hitch}>Hitch {snapshot.serverHitchMs}ms</span>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={!serverRunning}
        >
          Profiler + Resmon
        </button>
      </div>

      <div className={styles.history}>
        {history.map((point, index) => {
          const h = profilerBarHeight(point.totalMemoryMb, history);
          return (
            <div
              key={`${point.timestamp}-${index}`}
              className={styles.bar}
              style={{ height: `${h}%` }}
              title={`${point.totalMemoryMb.toFixed(1)} MiB`}
            />
          );
        })}
      </div>

      <div className={styles.list}>
        {topConsumers.length === 0 && (
          <p className={styles.empty}>
            Démarre FXServer et clique Profiler pour collecter les métriques.
          </p>
        )}
        {topConsumers.map((resource) => (
          <div key={resource.name} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.name}>{resource.name}</span>
              <span className={styles.score}>{resource.cpuScore.toFixed(1)}</span>
            </div>
            <div className={styles.meterTrack}>
              <div
                className={styles.meterFill}
                style={{ width: `${(resource.cpuScore / maxScore) * 100}%` }}
              />
            </div>
            <div className={styles.stats}>
              <span>{resource.memoryMb.toFixed(1)} MiB</span>
              <span>{resource.tickMs.toFixed(1)} ms tick</span>
            </div>
            {resource.alerts.length > 0 && (
              <p className={styles.alert}>{resource.alerts[0]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function profilerBarHeight(value: number, history: ProfilerSnapshot[]): number {
  const max = Math.max(...history.map((h) => h.totalMemoryMb), 1);
  return Math.max(8, (value / max) * 100);
}