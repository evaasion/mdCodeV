import { analyzeMigration, applyMigrationHints } from "@mdcodev/fivem-project";
import type { GamePlatform } from "../lib/settings";
import styles from "./MigrationPanel.module.css";

interface MigrationPanelProps {
  platform: GamePlatform;
  code: string;
  onApplyMigration: (code: string) => void;
}

export function MigrationPanel({ platform, code, onApplyMigration }: MigrationPanelProps) {
  const notes = analyzeMigration(code);
  const isGta6 = platform === "gta6";

  return (
    <div className={styles.panel}>
      <div className={styles.banner}>
        <span className={styles.platformBadge}>
          {isGta6 ? "GTA VI Preview" : "FiveM / GTA V"}
        </span>
        <p>
          {isGta6
            ? "Mode préparation GTA VI — analyse de compatibilité et suggestions de migration."
            : "Passe en mode GTA VI dans Settings → Plateforme pour activer l'assistant migration."}
        </p>
      </div>

      {notes.length === 0 ? (
        <p className={styles.empty}>Aucun point de migration détecté dans le fichier actif.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note, index) => (
            <li key={`${note.line}-${index}`} className={styles.item}>
              <span className={styles.line}>L{note.line}</span>
              <div>
                <p>{note.message}</p>
                {note.suggestion && <p className={styles.suggestion}>{note.suggestion}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          className={styles.applyBtn}
          onClick={() => onApplyMigration(applyMigrationHints(code))}
          disabled={!code.trim()}
        >
          Appliquer migrations auto
        </button>
      </div>
    </div>
  );
}