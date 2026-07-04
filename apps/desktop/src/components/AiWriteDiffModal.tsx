import { useMemo } from "react";
import { diffLines, diffStats } from "../lib/text-diff";
import styles from "./AiWriteDiffModal.module.css";

export interface AiWriteDiffRequest {
  path: string;
  displayPath: string;
  oldContent: string;
  newContent: string;
}

interface AiWriteDiffModalProps {
  request: AiWriteDiffRequest;
  onApply: () => void;
  onCancel: () => void;
}

export function AiWriteDiffModal({ request, onApply, onCancel }: AiWriteDiffModalProps) {
  const isNewFile = request.oldContent.length === 0;
  const lines = useMemo(
    () => diffLines(request.oldContent, request.newContent),
    [request.oldContent, request.newContent],
  );
  const stats = useMemo(() => diffStats(lines), [lines]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2>Écriture proposée par l&apos;agent</h2>
            <p className={styles.path}>{request.displayPath}</p>
          </div>
          <div className={styles.stats}>
            {isNewFile && <span className={styles.badge}>Nouveau fichier</span>}
            {stats.added > 0 && <span className={styles.statAdd}>+{stats.added}</span>}
            {stats.removed > 0 && <span className={styles.statRemove}>-{stats.removed}</span>}
          </div>
        </div>

        <div className={styles.body}>
          {lines.map((line, index) => {
            const rowClass =
              line.type === "add"
                ? styles.rowAdd
                : line.type === "remove"
                  ? styles.rowRemove
                  : styles.rowSame;
            const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

            return (
              <div key={`${line.type}-${index}`} className={`${styles.row} ${rowClass}`}>
                <span className={styles.lineNo}>{line.oldLineNum ?? ""}</span>
                <span className={styles.lineNo}>{line.newLineNum ?? ""}</span>
                <span className={styles.prefix}>{prefix}</span>
                <span className={styles.content}>{line.content || " "}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Annuler
          </button>
          <button className={styles.applyBtn} onClick={onApply}>
            Appliquer les changements
          </button>
        </div>
      </div>
    </div>
  );
}