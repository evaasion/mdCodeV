export interface SqlSelectContext {
  database: string;
  table: string;
}

export function escapeSqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export function escapeSqlIdentifier(value: string): string {
  return value.replace(/`/g, "``");
}

export function parseSelectContext(sql: string): SqlSelectContext | null {
  const cleaned = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  const qualified = cleaned.match(
    /\bfrom\s+`([^`]+)`\.`([^`]+)`/i,
  );
  if (qualified) {
    return { database: qualified[1], table: qualified[2] };
  }

  const simple = cleaned.match(/\bfrom\s+`([^`]+)`/i);
  if (simple) {
    return { database: "", table: simple[1] };
  }

  const qualifiedPlain = cleaned.match(/\bfrom\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/i);
  if (qualifiedPlain) {
    return { database: qualifiedPlain[1], table: qualifiedPlain[2] };
  }

  const simplePlain = cleaned.match(/\bfrom\s+([a-zA-Z0-9_]+)/i);
  if (simplePlain) {
    return { database: "", table: simplePlain[1] };
  }

  return null;
}

export function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${escapeSqlString(String(value))}'`;
}

export function buildUpdateSql(options: {
  database?: string;
  table: string;
  primaryKeyColumn: string;
  primaryKeyValue: unknown;
  column: string;
  newValue: unknown;
}): string {
  const tableRef = options.database
    ? `\`${escapeSqlIdentifier(options.database)}\`.\`${escapeSqlIdentifier(options.table)}\``
    : `\`${escapeSqlIdentifier(options.table)}\``;

  return `UPDATE ${tableRef} SET \`${escapeSqlIdentifier(options.column)}\` = ${formatSqlValue(options.newValue)} WHERE \`${escapeSqlIdentifier(options.primaryKeyColumn)}\` = ${formatSqlValue(options.primaryKeyValue)} LIMIT 1;`;
}

export function resultToCsv(columns: string[], rows: unknown[][]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [columns.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}