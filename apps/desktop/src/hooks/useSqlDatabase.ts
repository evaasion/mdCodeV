import { useCallback, useEffect, useState } from "react";
import {
  addSqlColumn,
  connectSql,
  createSqlIndex,
  describeSqlTable,
  disconnectSql,
  dropSqlIndex,
  executeSqlQuery,
  executeSqlScript,
  exportSqlTableDump,
  getSqlStatus,
  listSqlDatabases,
  listSqlTables,
  showCreateSqlTable,
  showSqlIndexes,
  type SqlAddColumnConfig,
  type SqlIndexConfig,
  type SqlQueryResult,
  type SqlScriptResult,
  type SqlStatus,
  type SqlTableDump,
} from "../lib/sql";
import {
  isDestructiveSql,
  isMutatingSql,
  loadSqlFavorites,
  loadSqlHistory,
  loadSqlSettings,
  pushSqlHistory,
  saveSqlSettings,
  toggleSqlFavorite,
  type SqlConnectPayload,
  type SqlSettings,
} from "../lib/sql-settings";

export interface SqlSchemaDatabase {
  name: string;
  tables?: string[];
  loadingTables?: boolean;
}

export function useSqlDatabase(sqlSettings: SqlSettings) {
  const [status, setStatus] = useState<SqlStatus>({ connected: false });
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [databases, setDatabases] = useState<SqlSchemaDatabase[]>([]);
  const [lastResult, setLastResult] = useState<SqlQueryResult | null>(null);
  const [history, setHistory] = useState<string[]>(() => loadSqlHistory());
  const [favorites, setFavorites] = useState<string[]>(() => loadSqlFavorites());

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getSqlStatus();
      setStatus(next);
      return next;
    } catch (err) {
      setStatus({ connected: false });
      setError(err instanceof Error ? err.message : "Statut SQL indisponible");
      return { connected: false };
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const refreshSchema = useCallback(async () => {
    if (!status.connected) {
      setDatabases([]);
      return;
    }

    setSchemaLoading(true);
    setError(null);
    try {
      const names = await listSqlDatabases();
      setDatabases(names.map((name) => ({ name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le schéma");
      setDatabases([]);
    } finally {
      setSchemaLoading(false);
    }
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      void refreshSchema();
    } else {
      setDatabases([]);
    }
  }, [status.connected, refreshSchema]);

  const connect = useCallback(async (payload: SqlConnectPayload) => {
    setConnecting(true);
    setError(null);
    try {
      const next = await connectSql(payload);
      setStatus(next);
      setLastResult(null);
      return next;
    } catch (err) {
      setStatus({ connected: false });
      const message = err instanceof Error ? err.message : "Connexion MySQL échouée";
      setError(message);
      throw new Error(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      const next = await disconnectSql();
      setStatus(next);
      setDatabases([]);
      setLastResult(null);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Déconnexion SQL échouée";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const loadTables = useCallback(async (database: string) => {
    setDatabases((prev) =>
      prev.map((entry) =>
        entry.name === database ? { ...entry, loadingTables: true } : entry,
      ),
    );
    try {
      const tables = await listSqlTables(database);
      setDatabases((prev) =>
        prev.map((entry) =>
          entry.name === database ? { ...entry, tables, loadingTables: false } : entry,
        ),
      );
    } catch (err) {
      setDatabases((prev) =>
        prev.map((entry) =>
          entry.name === database ? { ...entry, loadingTables: false } : entry,
        ),
      );
      setError(err instanceof Error ? err.message : "Impossible de lister les tables");
    }
  }, []);

  const confirmSql = useCallback(
    (_sql: string, kind: "mutating" | "destructive") => {
      if (!sqlSettings.confirmDestructive) return true;
      const message =
        kind === "destructive"
          ? "Cette requête peut supprimer des données ou des structures. Continuer ?"
          : "Cette requête va modifier des données. Continuer ?";
      return window.confirm(message);
    },
    [sqlSettings.confirmDestructive],
  );

  const executeQuery = useCallback(
    async (sql: string, options?: { skipChecks?: boolean }) => {
      if (!status.connected) {
        throw new Error("Connecte-toi à MySQL d'abord");
      }

      const trimmed = sql.trim();
      if (!trimmed) return null;

      if (!options?.skipChecks) {
        if (isDestructiveSql(trimmed) && !confirmSql(trimmed, "destructive")) return null;
        if (isMutatingSql(trimmed) && !isDestructiveSql(trimmed) && !confirmSql(trimmed, "mutating")) {
          return null;
        }
      }

      setExecuting(true);
      setError(null);
      try {
        const result = await executeSqlQuery(trimmed, sqlSettings.maxRows);
        setLastResult(result);
        setHistory(pushSqlHistory(trimmed));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur SQL";
        setError(message);
        throw new Error(message);
      } finally {
        setExecuting(false);
      }
    },
    [confirmSql, sqlSettings.maxRows, status.connected],
  );

  const describeTable = useCallback(async (database: string, table: string) => {
    setExecuting(true);
    setError(null);
    try {
      const result = await describeSqlTable(database, table);
      setLastResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "DESCRIBE échoué";
      setError(message);
      throw new Error(message);
    } finally {
      setExecuting(false);
    }
  }, []);

  const toggleFavorite = useCallback((sql: string) => {
    const next = toggleSqlFavorite(sql);
    setFavorites(next);
    return next;
  }, []);

  const explainQuery = useCallback(
    async (sql: string) => {
      const trimmed = sql.trim().replace(/;+\s*$/, "");
      if (!trimmed) return null;
      const explainSql = /^explain\b/i.test(trimmed) ? `${trimmed};` : `EXPLAIN ${trimmed};`;
      return executeQuery(explainSql, { skipChecks: true });
    },
    [executeQuery],
  );

  const runScript = useCallback(
    async (sql: string, useTransaction = true): Promise<SqlScriptResult> => {
      if (!status.connected) {
        throw new Error("Connecte-toi à MySQL d'abord");
      }

      const trimmed = sql.trim();
      if (!trimmed) {
        throw new Error("Script SQL vide");
      }

      if (isDestructiveSql(trimmed) && !confirmSql(trimmed, "destructive")) {
        throw new Error("Import annulé");
      }

      setExecuting(true);
      setError(null);
      try {
        const result = await executeSqlScript(trimmed, useTransaction);
        if (result.errors.length > 0) {
          throw new Error(result.errors.join("\n\n"));
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Script SQL échoué";
        setError(message);
        throw new Error(message);
      } finally {
        setExecuting(false);
      }
    },
    [confirmSql, status.connected],
  );

  const fetchTableDdl = useCallback(async (database: string, table: string) => {
    setError(null);
    try {
      return await showCreateSqlTable(database, table);
    } catch (err) {
      const message = err instanceof Error ? err.message : "DDL introuvable";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const fetchTableDump = useCallback(
    async (database: string, table: string, maxRows?: number): Promise<SqlTableDump> => {
      setError(null);
      try {
        return await exportSqlTableDump(database, table, maxRows ?? sqlSettings.maxRows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export dump échoué";
        setError(message);
        throw new Error(message);
      }
    },
    [sqlSettings.maxRows],
  );

  const fetchTableIndexes = useCallback(async (database: string, table: string) => {
    setExecuting(true);
    setError(null);
    try {
      const result = await showSqlIndexes(database, table);
      setLastResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "SHOW INDEX échoué";
      setError(message);
      throw new Error(message);
    } finally {
      setExecuting(false);
    }
  }, []);

  const addColumn = useCallback(
    async (config: SqlAddColumnConfig) => {
      if (!confirmSql(`ADD COLUMN ${config.columnName}`, "destructive")) {
        return null;
      }
      setExecuting(true);
      setError(null);
      try {
        const result = await addSqlColumn(config);
        setLastResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "ADD COLUMN échoué";
        setError(message);
        throw new Error(message);
      } finally {
        setExecuting(false);
      }
    },
    [confirmSql],
  );

  const createIndex = useCallback(
    async (config: SqlIndexConfig) => {
      if (!confirmSql(`CREATE INDEX ${config.indexName}`, "destructive")) {
        return null;
      }
      setExecuting(true);
      setError(null);
      try {
        const result = await createSqlIndex(config);
        setLastResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "CREATE INDEX échoué";
        setError(message);
        throw new Error(message);
      } finally {
        setExecuting(false);
      }
    },
    [confirmSql],
  );

  const dropIndex = useCallback(
    async (database: string, table: string, indexName: string) => {
      if (!confirmSql(`DROP INDEX ${indexName}`, "destructive")) {
        return null;
      }
      setExecuting(true);
      setError(null);
      try {
        const result = await dropSqlIndex(database, table, indexName);
        setLastResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "DROP INDEX échoué";
        setError(message);
        throw new Error(message);
      } finally {
        setExecuting(false);
      }
    },
    [confirmSql],
  );

  return {
    status,
    error,
    connecting,
    executing,
    schemaLoading,
    databases,
    lastResult,
    history,
    favorites,
    settings: sqlSettings,
    connect,
    disconnect,
    refreshStatus,
    refreshSchema,
    loadTables,
    executeQuery,
    explainQuery,
    runScript,
    describeTable,
    fetchTableDdl,
    fetchTableDump,
    fetchTableIndexes,
    addColumn,
    createIndex,
    dropIndex,
    toggleFavorite,
    updateSettings: saveSqlSettings,
  };
}

export { loadSqlSettings, type SqlSettings };