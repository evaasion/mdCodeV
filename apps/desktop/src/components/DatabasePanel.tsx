import { useMemo, useState } from "react";
import type { SqlQueryResult, SqlStatus } from "../lib/sql";
import { buildUpdateSql, downloadCsv, parseSelectContext, resultToCsv } from "../lib/sql-query-utils";
import type { SqlSelectContext } from "../lib/sql-query-utils";
import styles from "./DatabasePanel.module.css";

interface DatabasePanelProps {
  status: SqlStatus;
  query: string;
  executing: boolean;
  error: string | null;
  result: SqlQueryResult | null;
  maxRows: number;
  history: string[];
  favorites: string[];
  selectContext: SqlSelectContext | null;
  onQueryChange: (value: string) => void;
  onExecute: (sql?: string) => void;
  onExplain: (sql?: string) => void;
  onImport: () => void;
  onConnect: () => void;
  onToggleFavorite: (sql: string) => void;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DatabasePanel({
  status,
  query,
  executing,
  error,
  result,
  maxRows,
  history,
  favorites,
  selectContext,
  onQueryChange,
  onExecute,
  onExplain,
  onImport,
  onConnect,
  onToggleFavorite,
}: DatabasePanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState<{
    rowIndex: number;
    columnIndex: number;
    value: string;
  } | null>(null);

  const isFavorite = favorites.includes(query.trim());
  const canExplain = /^\s*select\b/i.test(query.trim());
  const context = useMemo(
    () => selectContext ?? parseSelectContext(query),
    [query, selectContext],
  );

  function runQuery(next?: string) {
    const sql = (next ?? query).trim();
    if (!sql) return;
    onQueryChange(next ?? query);
    onExecute(next ?? query);
  }

  function exportCsv() {
    if (!result || result.columns.length === 0) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const table = context?.table ?? "query";
    downloadCsv(`${table}-${stamp}.csv`, resultToCsv(result.columns, result.rows));
  }

  async function commitInlineEdit() {
    if (!editing || !result || !context?.table) return;

    const row = result.rows[editing.rowIndex];
    const column = result.columns[editing.columnIndex];
    const primaryKeyColumn = result.columns[0];
    const primaryKeyValue = row[0];

    const updateSql = buildUpdateSql({
      database: context.database || status.database || undefined,
      table: context.table,
      primaryKeyColumn,
      primaryKeyValue,
      column,
      newValue: editing.value,
    });

    const confirmed = window.confirm(`Appliquer cette modification ?\n\n${updateSql}`);
    if (!confirmed) {
      setEditing(null);
      return;
    }

    onQueryChange(updateSql);
    onExecute(updateSql);
    setEditing(null);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.status}>
          <span className={status.connected ? styles.dotOn : styles.dotOff}>●</span>
          {status.connected
            ? `MySQL · ${status.username}@${status.host}`
            : "MySQL déconnecté"}
        </div>
        <div className={styles.actions}>
          {!status.connected && (
            <button className={styles.action} onClick={onConnect}>
              Connecter
            </button>
          )}
          <button
            className={styles.action}
            onClick={() => setShowHistory((value) => !value)}
            disabled={history.length === 0 && favorites.length === 0}
          >
            Historique
          </button>
          <button
            className={isFavorite ? styles.favoriteOn : styles.action}
            onClick={() => onToggleFavorite(query)}
            disabled={!query.trim()}
            title="Ajouter aux favoris"
          >
            ★
          </button>
          <button
            className={styles.action}
            onClick={exportCsv}
            disabled={!result || result.columns.length === 0}
          >
            CSV
          </button>
          <button
            className={styles.action}
            onClick={() => onImport()}
            disabled={!status.connected}
          >
            Import
          </button>
          <button
            className={styles.action}
            onClick={() => onExplain(query)}
            disabled={!status.connected || executing || !canExplain}
            title="EXPLAIN sur SELECT"
          >
            EXPLAIN
          </button>
          <button
            className={styles.runBtn}
            onClick={() => runQuery()}
            disabled={!status.connected || executing || !query.trim()}
          >
            {executing ? "Exécution..." : "Exécuter ⌘↵"}
          </button>
        </div>
      </div>

      {showHistory && (history.length > 0 || favorites.length > 0) && (
        <div className={styles.historyPane}>
          {favorites.length > 0 && (
            <div className={styles.historyGroup}>
              <p className={styles.historyTitle}>Favoris</p>
              {favorites.map((entry) => (
                <button key={`fav-${entry}`} className={styles.historyItem} onClick={() => {
                  onQueryChange(entry);
                  runQuery(entry);
                }}>
                  {entry}
                </button>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div className={styles.historyGroup}>
              <p className={styles.historyTitle}>Récent</p>
              {history.slice(0, 12).map((entry) => (
                <button key={`hist-${entry}`} className={styles.historyItem} onClick={() => {
                  onQueryChange(entry);
                  runQuery(entry);
                }}>
                  {entry}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <textarea
        className={styles.editor}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            runQuery();
          }
        }}
        placeholder={
          status.connected
            ? "SELECT * FROM players LIMIT 50;"
            : "Connecte MySQL pour exécuter des requêtes"
        }
        spellCheck={false}
      />

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.resultMeta}>
          <span>
            {result.rows.length} ligne{result.rows.length > 1 ? "s" : ""}
            {result.truncated ? ` (limité à ${maxRows})` : ""}
          </span>
          <span>{result.executionTimeMs} ms</span>
          {context?.table && (
            <span>
              {context.database ? `${context.database}.` : ""}
              {context.table}
            </span>
          )}
          {result.affectedRows > 0 && result.columns.length === 0 && (
            <span>{result.affectedRows} ligne(s) affectée(s)</span>
          )}
        </div>
      )}

      {result && result.columns.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const editingCell =
                      editing?.rowIndex === rowIndex && editing.columnIndex === cellIndex;
                    return (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        onDoubleClick={() => {
                          if (!context?.table || cellIndex === 0) return;
                          setEditing({
                            rowIndex,
                            columnIndex: cellIndex,
                            value: formatCell(cell),
                          });
                        }}
                        title={
                          context?.table && cellIndex !== 0
                            ? "Double-clic pour modifier"
                            : undefined
                        }
                      >
                        {editingCell ? (
                          <input
                            className={styles.cellInput}
                            autoFocus
                            value={editing.value}
                            onChange={(event) =>
                              setEditing((prev) =>
                                prev ? { ...prev, value: event.target.value } : prev,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void commitInlineEdit();
                              if (event.key === "Escape") setEditing(null);
                            }}
                            onBlur={() => void commitInlineEdit()}
                          />
                        ) : (
                          formatCell(cell)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.columns.length === 0 && result.affectedRows === 0 && !error && (
        <p className={styles.empty}>Requête exécutée sans résultat.</p>
      )}
    </div>
  );
}