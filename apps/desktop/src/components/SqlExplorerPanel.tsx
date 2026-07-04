import { useEffect, useState } from "react";
import type { SqlSchemaDatabase } from "../hooks/useSqlDatabase";
import type { SqlStatus } from "../lib/sql";
import type { SqlSelectContext } from "../lib/sql-query-utils";
import styles from "./SqlExplorerPanel.module.css";

interface SqlExplorerPanelProps {
  status: SqlStatus;
  databases: SqlSchemaDatabase[];
  schemaLoading: boolean;
  selectContext: SqlSelectContext | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onLoadTables: (database: string) => void;
  onPreviewTable: (database: string, table: string) => void;
  onDescribeTable: (database: string, table: string) => void;
  onOpenTableTools: (database: string, table: string) => void;
}

export function SqlExplorerPanel({
  status,
  databases,
  schemaLoading,
  selectContext,
  onConnect,
  onDisconnect,
  onRefresh,
  onLoadTables,
  onPreviewTable,
  onDescribeTable,
  onOpenTableTools,
}: SqlExplorerPanelProps) {
  const [openDatabases, setOpenDatabases] = useState<Record<string, boolean>>({});
  const [showAllDatabases, setShowAllDatabases] = useState(() => !status.database);

  useEffect(() => {
    if (!status.connected || !status.database) return;
    setShowAllDatabases(false);
    setOpenDatabases((prev) => ({ ...prev, [status.database!]: true }));
    const entry = databases.find((database) => database.name === status.database);
    if (!entry?.tables) {
      void onLoadTables(status.database);
    }
  }, [status.connected, status.database, databases, onLoadTables]);

  const visibleDatabases =
    showAllDatabases || !status.database
      ? databases
      : databases.filter((database) => database.name === status.database);

  async function toggleDatabase(name: string) {
    const nextOpen = !openDatabases[name];
    setOpenDatabases((prev) => ({ ...prev, [name]: nextOpen }));
    if (nextOpen) {
      const entry = databases.find((database) => database.name === name);
      if (!entry?.tables) {
        await onLoadTables(name);
      }
    }
  }

  return (
    <div className={styles.explorer}>
      <div className={styles.toolbar}>
        {status.connected ? (
          <>
            <button className={styles.toolBtn} onClick={onRefresh} disabled={schemaLoading}>
              ↻
            </button>
            {status.database && (
              <button
                className={showAllDatabases ? styles.toolBtn : styles.toolBtnActive}
                onClick={() => setShowAllDatabases((value) => !value)}
                title={showAllDatabases ? "Base active uniquement" : "Toutes les bases"}
              >
                {showAllDatabases ? "Toutes" : status.database}
              </button>
            )}
            <button className={styles.toolBtn} onClick={onDisconnect}>
              Déco
            </button>
          </>
        ) : (
          <button className={styles.connectBtn} onClick={onConnect}>
            Connecter MySQL
          </button>
        )}
      </div>

      {status.connected ? (
        <>
          <div className={styles.meta}>
            <p className={styles.host}>
              {status.username}@{status.host}:{status.port}
            </p>
            {status.database && <p className={styles.database}>Base active · {status.database}</p>}
          </div>
          <div className={styles.tree}>
            {schemaLoading && <p className={styles.hint}>Chargement des bases...</p>}
            {!schemaLoading && visibleDatabases.length === 0 && (
              <p className={styles.hint}>Aucune base visible</p>
            )}
            {!schemaLoading &&
              visibleDatabases.map((database) => {
                const open = !!openDatabases[database.name];
                return (
                  <div key={database.name}>
                    <button
                      className={styles.dir}
                      onClick={() => void toggleDatabase(database.name)}
                    >
                      <span className={styles.chevron}>
                        {database.loadingTables ? "…" : open ? "▾" : "▸"}
                      </span>
                      <span className={styles.folderIcon}>🗄</span>
                      {database.name}
                    </button>
                    {open &&
                      database.tables?.map((table) => {
                        const selected =
                          selectContext?.table === table &&
                          (selectContext.database === database.name ||
                            (!selectContext.database && database.name === status.database));
                        return (
                        <div key={`${database.name}.${table}`} className={styles.tableRow}>
                          <button
                            className={selected ? styles.tableBtnActive : styles.tableBtn}
                            onClick={() => onPreviewTable(database.name, table)}
                            title="Voir les données"
                          >
                            <span className={styles.tableIcon}>▣</span>
                            {table}
                          </button>
                          <button
                            className={styles.describeBtn}
                            onClick={() => onDescribeTable(database.name, table)}
                            title="DESCRIBE"
                          >
                            ?
                          </button>
                          <button
                            className={styles.describeBtn}
                            onClick={() => onOpenTableTools(database.name, table)}
                            title="Outils table (DDL, dump, index)"
                          >
                            ⚙
                          </button>
                        </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucune connexion MySQL</p>
          <p className={styles.emptyText}>
            Connecte ta base oxmysql / mysql-async pour explorer tables et exécuter des requêtes
            sans quitter mdcodeV.
          </p>
        </div>
      )}
    </div>
  );
}