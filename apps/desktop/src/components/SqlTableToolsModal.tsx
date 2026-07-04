import { useCallback, useEffect, useState } from "react";
import {
  buildTableDumpSql,
  type SqlAddColumnConfig,
  type SqlIndexConfig,
  type SqlQueryResult,
  type SqlTableDump,
} from "../lib/sql";
import styles from "./SqlTableToolsModal.module.css";

type TabId = "ddl" | "dump" | "indexes" | "designer";

interface SqlTableToolsModalProps {
  database: string;
  table: string;
  executing: boolean;
  onClose: () => void;
  onFetchDdl: (database: string, table: string) => Promise<string>;
  onFetchDump: (database: string, table: string) => Promise<SqlTableDump>;
  onFetchIndexes: (database: string, table: string) => Promise<SqlQueryResult>;
  onAddColumn: (config: SqlAddColumnConfig) => Promise<SqlQueryResult | null>;
  onCreateIndex: (config: SqlIndexConfig) => Promise<SqlQueryResult | null>;
  onDropIndex: (
    database: string,
    table: string,
    indexName: string,
  ) => Promise<SqlQueryResult | null>;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SqlTableToolsModal({
  database,
  table,
  executing,
  onClose,
  onFetchDdl,
  onFetchDump,
  onFetchIndexes,
  onAddColumn,
  onCreateIndex,
  onDropIndex,
}: SqlTableToolsModalProps) {
  const [tab, setTab] = useState<TabId>("ddl");
  const [ddl, setDdl] = useState("");
  const [dump, setDump] = useState<SqlTableDump | null>(null);
  const [indexes, setIndexes] = useState<SqlQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState("VARCHAR(255)");
  const [columnNullable, setColumnNullable] = useState(true);
  const [columnDefault, setColumnDefault] = useState("");

  const [indexName, setIndexName] = useState("");
  const [indexColumns, setIndexColumns] = useState("");
  const [indexUnique, setIndexUnique] = useState(false);

  const qualified = database ? `${database}.${table}` : table;

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (tab === "ddl") {
        setDdl(await onFetchDdl(database, table));
      } else if (tab === "dump") {
        setDump(await onFetchDump(database, table));
      } else if (tab === "indexes") {
        setIndexes(await onFetchIndexes(database, table));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement échoué");
    } finally {
      setLoading(false);
    }
  }, [database, onFetchDdl, onFetchDump, onFetchIndexes, tab, table]);

  useEffect(() => {
    if (tab !== "designer") {
      void loadTab();
    }
  }, [loadTab, tab]);

  async function handleAddColumn() {
    setError(null);
    setSuccess(null);
    try {
      await onAddColumn({
        database,
        table,
        columnName: columnName.trim(),
        columnType: columnType.trim(),
        nullable: columnNullable,
        defaultValue: columnDefault.trim() || undefined,
      });
      setSuccess(`Colonne ${columnName} ajoutée`);
      setColumnName("");
      setColumnDefault("");
      if (tab === "ddl") void loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ADD COLUMN échoué");
    }
  }

  async function handleCreateIndex() {
    setError(null);
    setSuccess(null);
    const columns = indexColumns
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    try {
      await onCreateIndex({
        database,
        table,
        indexName: indexName.trim(),
        columns,
        unique: indexUnique,
      });
      setSuccess(`Index ${indexName} créé`);
      setIndexName("");
      setIndexColumns("");
      if (tab === "indexes") void loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CREATE INDEX échoué");
    }
  }

  async function handleDropIndex(name: string) {
    setError(null);
    setSuccess(null);
    try {
      await onDropIndex(database, table, name);
      setSuccess(`Index ${name} supprimé`);
      void loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : "DROP INDEX échoué");
    }
  }

  function exportDump() {
    if (!dump) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadText(`${table}-${stamp}.sql`, buildTableDumpSql(dump));
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Outils · {qualified}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          {(
            [
              ["ddl", "DDL"],
              ["dump", "Export dump"],
              ["indexes", "Index"],
              ["designer", "Designer"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? styles.tabActive : styles.tab}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.hint}>Chargement...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          {tab === "ddl" && !loading && (
            <>
              <textarea value={ddl} readOnly spellCheck={false} />
              <div className={styles.footer} style={{ border: "none", padding: 0 }}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => downloadText(`${table}.ddl.sql`, ddl)}
                  disabled={!ddl}
                >
                  Télécharger .sql
                </button>
              </div>
            </>
          )}

          {tab === "dump" && !loading && dump && (
            <>
              <p className={styles.hint}>
                {dump.rowCount} ligne{dump.rowCount > 1 ? "s" : ""} exportée
                {dump.rowCount > 1 ? "s" : ""}
                {dump.truncated ? " (tronqué)" : ""}
              </p>
              <textarea value={buildTableDumpSql(dump)} readOnly spellCheck={false} />
              <div className={styles.footer} style={{ border: "none", padding: 0 }}>
                <button className={styles.primaryBtn} onClick={exportDump}>
                  Télécharger dump .sql
                </button>
              </div>
            </>
          )}

          {tab === "indexes" && !loading && (
            <>
              {indexes && indexes.rows.length > 0 ? (
                <div className={styles.indexList}>
                  {indexes.rows.map((row, index) => {
                    const keyName = String(row[2] ?? "");
                    const columnName = String(row[4] ?? "");
                    const nonUnique = row[1];
                    return (
                      <div key={`${keyName}-${index}`} className={styles.indexItem}>
                        <span>
                          <strong>{keyName}</strong> · {columnName}
                          {nonUnique === 0 ? " · UNIQUE" : ""}
                        </span>
                        {keyName !== "PRIMARY" && (
                          <button
                            className={styles.secondaryBtn}
                            onClick={() => void handleDropIndex(keyName)}
                            disabled={executing}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.hint}>Aucun index</p>
              )}

              <p className={styles.hint}>Créer un index</p>
              <div className={styles.row}>
                <label>
                  Nom
                  <input value={indexName} onChange={(e) => setIndexName(e.target.value)} />
                </label>
                <label>
                  Colonnes (séparées par ,)
                  <input
                    value={indexColumns}
                    onChange={(e) => setIndexColumns(e.target.value)}
                    placeholder="identifier, created_at"
                  />
                </label>
              </div>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={indexUnique}
                  onChange={(e) => setIndexUnique(e.target.checked)}
                />
                Index UNIQUE
              </label>
              <button
                className={styles.primaryBtn}
                onClick={() => void handleCreateIndex()}
                disabled={executing || !indexName.trim() || !indexColumns.trim()}
              >
                Créer l'index
              </button>
            </>
          )}

          {tab === "designer" && (
            <>
              <p className={styles.hint}>Ajouter une colonne à la table</p>
              <div className={styles.row}>
                <label>
                  Nom
                  <input value={columnName} onChange={(e) => setColumnName(e.target.value)} />
                </label>
                <label>
                  Type
                  <input value={columnType} onChange={(e) => setColumnType(e.target.value)} />
                </label>
              </div>
              <div className={styles.row}>
                <label>
                  Défaut (optionnel)
                  <input
                    value={columnDefault}
                    onChange={(e) => setColumnDefault(e.target.value)}
                    placeholder="NULL ou 'valeur'"
                  />
                </label>
              </div>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={columnNullable}
                  onChange={(e) => setColumnNullable(e.target.checked)}
                />
                Nullable
              </label>
              <button
                className={styles.primaryBtn}
                onClick={() => void handleAddColumn()}
                disabled={executing || !columnName.trim() || !columnType.trim()}
              >
                ADD COLUMN
              </button>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}