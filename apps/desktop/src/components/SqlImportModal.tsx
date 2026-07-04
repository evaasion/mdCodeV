import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { SqlScriptResult } from "../lib/sql";
import styles from "./SqlImportModal.module.css";

interface SqlImportModalProps {
  executing: boolean;
  onClose: () => void;
  onImport: (sql: string, useTransaction: boolean) => Promise<SqlScriptResult>;
}

export function SqlImportModal({ executing, onClose, onImport }: SqlImportModalProps) {
  const [sql, setSql] = useState("");
  const [useTransaction, setUseTransaction] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  async function pickFile() {
    setLoadingFile(true);
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SQL", extensions: ["sql", "txt"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const content = await readTextFile(selected);
      setSql(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture fichier échouée");
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleImport() {
    setError(null);
    setResult(null);
    try {
      const outcome = await onImport(sql, useTransaction);
      setResult(
        `${outcome.statementsExecuted} requête(s) exécutée(s) · ${outcome.totalAffectedRows} ligne(s) affectée(s) · ${outcome.executionTimeMs} ms`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import échoué");
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Importer script SQL</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <button className={styles.secondaryBtn} onClick={() => void pickFile()} disabled={loadingFile}>
              {loadingFile ? "Lecture..." : "Ouvrir .sql"}
            </button>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={useTransaction}
                onChange={(event) => setUseTransaction(event.target.checked)}
              />
              Transaction (ROLLBACK si erreur)
            </label>
          </div>

          <p className={styles.hint}>
            Colle ou charge un fichier .sql multi-requêtes (CREATE, INSERT, ALTER…). Les lignes
            commençant par -- sont ignorées.
          </p>

          <textarea
            className={styles.editor}
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            placeholder="-- dump.sql&#10;CREATE TABLE ...;&#10;INSERT INTO ...;"
            spellCheck={false}
          />

          {error && <p className={styles.error}>{error}</p>}
          {result && <p className={styles.result}>{result}</p>}
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Fermer
          </button>
          <button
            className={styles.runBtn}
            onClick={() => void handleImport()}
            disabled={executing || !sql.trim()}
          >
            {executing ? "Exécution..." : "Exécuter le script"}
          </button>
        </div>
      </div>
    </div>
  );
}