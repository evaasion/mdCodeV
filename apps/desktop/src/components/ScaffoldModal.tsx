import { useState } from "react";
import { SCAFFOLD_OPTIONS, buildScaffold, type ScaffoldKind } from "@mdcodev/fivem-project";
import styles from "./ScaffoldModal.module.css";

interface ScaffoldModalProps {
  projectRoot: string;
  onScaffold: (resourceName: string, files: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export function ScaffoldModal({ projectRoot, onScaffold, onClose }: ScaffoldModalProps) {
  const [kind, setKind] = useState<ScaffoldKind>("resource-basic");
  const [resourceName, setResourceName] = useState("my-resource");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = buildScaffold(kind, resourceName);

  async function handleCreate() {
    if (!resourceName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onScaffold(resourceName.trim(), preview.files);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Nouvelle ressource FiveM</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.root}>Dossier: {projectRoot}</p>

          <label>
            Template
            <select value={kind} onChange={(e) => setKind(e.target.value as ScaffoldKind)}>
              {SCAFFOLD_OPTIONS.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label} — {option.description}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nom de la ressource
            <input
              value={resourceName}
              onChange={(e) => setResourceName(e.target.value)}
              placeholder="my-job"
            />
          </label>

          <div className={styles.preview}>
            <p>Fichiers générés:</p>
            <ul>
              {Object.keys(preview.files).map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Annuler
          </button>
          <button
            className={styles.createBtn}
            onClick={() => void handleCreate()}
            disabled={loading}
          >
            {loading ? "Création..." : "Créer la ressource"}
          </button>
        </div>
      </div>
    </div>
  );
}