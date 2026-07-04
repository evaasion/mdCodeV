import { invoke } from "@tauri-apps/api/core";
import type { SqlConnectPayload } from "./sql-settings";

export interface SqlStatus {
  connected: boolean;
  host?: string;
  username?: string;
  port?: number;
  database?: string;
}

export interface SqlQueryResult {
  columns: string[];
  rows: unknown[][];
  affectedRows: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface SqlScriptResult {
  statementsExecuted: number;
  totalAffectedRows: number;
  executionTimeMs: number;
  errors: string[];
}

export interface SqlTableDump {
  ddl: string;
  inserts: string;
  rowCount: number;
  truncated: boolean;
}

export interface SqlAddColumnConfig {
  database: string;
  table: string;
  columnName: string;
  columnType: string;
  nullable?: boolean;
  defaultValue?: string;
}

export interface SqlIndexConfig {
  database: string;
  table: string;
  indexName: string;
  columns: string[];
  unique?: boolean;
}

interface RawSqlStatus {
  connected: boolean;
  host?: string;
  username?: string;
  port?: number;
  database?: string;
}

interface RawSqlQueryResult {
  columns: string[];
  rows: unknown[][];
  affectedRows: number;
  executionTimeMs: number;
  truncated: boolean;
}

interface RawSqlScriptResult {
  statementsExecuted: number;
  totalAffectedRows: number;
  executionTimeMs: number;
  errors: string[];
}

interface RawSqlTableDump {
  ddl: string;
  inserts: string;
  rowCount: number;
  truncated: boolean;
}

function mapStatus(raw: RawSqlStatus): SqlStatus {
  return {
    connected: raw.connected,
    host: raw.host,
    username: raw.username,
    port: raw.port,
    database: raw.database,
  };
}

function mapQueryResult(raw: RawSqlQueryResult): SqlQueryResult {
  return {
    columns: raw.columns,
    rows: raw.rows,
    affectedRows: raw.affectedRows,
    executionTimeMs: raw.executionTimeMs,
    truncated: raw.truncated,
  };
}

function mapScriptResult(raw: RawSqlScriptResult): SqlScriptResult {
  return {
    statementsExecuted: raw.statementsExecuted,
    totalAffectedRows: raw.totalAffectedRows,
    executionTimeMs: raw.executionTimeMs,
    errors: raw.errors,
  };
}

function mapTableDump(raw: RawSqlTableDump): SqlTableDump {
  return {
    ddl: raw.ddl,
    inserts: raw.inserts,
    rowCount: raw.rowCount,
    truncated: raw.truncated,
  };
}

export async function connectSql(payload: SqlConnectPayload): Promise<SqlStatus> {
  const result = await invoke<RawSqlStatus>("sql_connect", { config: payload });
  return mapStatus(result);
}

export async function disconnectSql(): Promise<SqlStatus> {
  const result = await invoke<RawSqlStatus>("sql_disconnect");
  return mapStatus(result);
}

export async function getSqlStatus(): Promise<SqlStatus> {
  const result = await invoke<RawSqlStatus>("sql_status");
  return mapStatus(result);
}

export async function executeSqlQuery(sql: string, maxRows?: number): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_query", { sql, maxRows });
  return mapQueryResult(result);
}

export async function listSqlDatabases(): Promise<string[]> {
  return invoke<string[]>("sql_list_databases");
}

export async function listSqlTables(database: string): Promise<string[]> {
  return invoke<string[]>("sql_list_tables", { database });
}

export async function describeSqlTable(
  database: string,
  table: string,
): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_describe_table", { database, table });
  return mapQueryResult(result);
}

export async function showCreateSqlTable(database: string, table: string): Promise<string> {
  return invoke<string>("sql_show_create_table", { database, table });
}

export async function exportSqlTableDump(
  database: string,
  table: string,
  maxRows?: number,
): Promise<SqlTableDump> {
  const result = await invoke<RawSqlTableDump>("sql_export_table_dump", {
    database,
    table,
    maxRows,
  });
  return mapTableDump(result);
}

export async function executeSqlScript(
  sql: string,
  useTransaction?: boolean,
): Promise<SqlScriptResult> {
  const result = await invoke<RawSqlScriptResult>("sql_execute_script", { sql, useTransaction });
  return mapScriptResult(result);
}

export async function showSqlIndexes(
  database: string,
  table: string,
): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_show_indexes", { database, table });
  return mapQueryResult(result);
}

export async function addSqlColumn(config: SqlAddColumnConfig): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_add_column", { config });
  return mapQueryResult(result);
}

export async function createSqlIndex(config: SqlIndexConfig): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_create_index", { config });
  return mapQueryResult(result);
}

export async function dropSqlIndex(
  database: string,
  table: string,
  indexName: string,
): Promise<SqlQueryResult> {
  const result = await invoke<RawSqlQueryResult>("sql_drop_index", {
    database,
    table,
    indexName,
  });
  return mapQueryResult(result);
}

export async function saveSqlKeychainPassword(
  profileId: string,
  password: string,
): Promise<void> {
  await invoke("sql_keychain_save", { profileId, password });
}

export async function getSqlKeychainPassword(profileId: string): Promise<string | null> {
  const result = await invoke<string | null>("sql_keychain_get", { profileId });
  return result;
}

export async function deleteSqlKeychainPassword(profileId: string): Promise<void> {
  await invoke("sql_keychain_delete", { profileId });
}

export function formatTablePreviewQuery(database: string, table: string, limit = 50): string {
  const escape = (value: string) => value.replace(/`/g, "``");
  return `SELECT * FROM \`${escape(database)}\`.\`${escape(table)}\` LIMIT ${limit};`;
}

export function formatExplainQuery(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (/^explain\b/i.test(trimmed)) return `${trimmed};`;
  return `EXPLAIN ${trimmed};`;
}

export function buildTableDumpSql(dump: SqlTableDump): string {
  const parts = [dump.ddl.trim()];
  if (!parts[0].endsWith(";")) parts[0] += ";";
  if (dump.inserts.trim()) {
    parts.push("", dump.inserts.trim());
  }
  return parts.join("\n");
}