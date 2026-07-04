import type { LintDiagnostic } from "@mdcodev/linter-core";
import styles from "./ProblemsPanel.module.css";

interface ProblemsPanelProps {
  diagnostics: LintDiagnostic[];
  onSelect: (diagnostic: LintDiagnostic) => void;
}

const SEVERITY_ICON: Record<LintDiagnostic["severity"], string> = {
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ProblemsPanel({ diagnostics, onSelect }: ProblemsPanelProps) {
  if (diagnostics.length === 0) {
    return (
      <div className={styles.empty}>
        Aucun problème détecté — le linter FiveM est actif.
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {diagnostics.map((diagnostic, index) => (
        <button
          key={`${diagnostic.line}-${diagnostic.column}-${index}`}
          className={styles.item}
          onClick={() => onSelect(diagnostic)}
        >
          <span className={`${styles.icon} ${styles[diagnostic.severity]}`}>
            {SEVERITY_ICON[diagnostic.severity]}
          </span>
          <span className={styles.message}>{diagnostic.message}</span>
          <span className={styles.location}>
            L{diagnostic.line}:{diagnostic.column}
          </span>
        </button>
      ))}
    </div>
  );
}