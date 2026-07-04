import { readProjectFile } from "./project-fs";
import type { ProjectInfo } from "./tauri-fs";
import type { SqlConnectPayload } from "./sql-settings";

export interface DetectedSqlConfig extends SqlConnectPayload {
  source: string;
  label: string;
}

function parseMysqlUri(value: string): SqlConnectPayload | null {
  try {
    const normalized = value.replace(/^mysql:\/\//, "http://");
    const url = new URL(normalized);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      username: decodeURIComponent(url.username),
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database: url.pathname.replace(/^\//, "") || undefined,
    };
  } catch {
    return null;
  }
}

function parseKeyValueConnection(value: string): SqlConnectPayload | null {
  const parts = value.split(/[;,&]/).map((part) => part.trim());
  const map = new Map<string, string>();
  for (const part of parts) {
    const [key, raw] = part.split("=").map((segment) => segment.trim());
    if (!key || !raw) continue;
    map.set(key.toLowerCase(), raw.replace(/^["']|["']$/g, ""));
  }

  const host = map.get("host") ?? map.get("server");
  const username = map.get("user") ?? map.get("username") ?? map.get("uid");
  if (!host || !username) return null;

  return {
    host,
    port: Number(map.get("port") ?? 3306) || 3306,
    username,
    password: map.get("password") ?? map.get("pass") ?? map.get("pwd"),
    database: map.get("database") ?? map.get("db") ?? map.get("schema"),
  };
}

function parseConnectionValue(raw: string): SqlConnectPayload | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("mysql://")) return parseMysqlUri(value);
  if (/host\s*=/i.test(value) || /user\s*=/i.test(value)) {
    return parseKeyValueConnection(value);
  }
  if (value.includes("@") && value.includes("/")) {
    const uri = parseMysqlUri(`mysql://${value.replace(/^mysql:\/\//, "")}`);
    if (uri) return uri;
  }
  return null;
}

function extractFromText(content: string): SqlConnectPayload[] {
  const found: SqlConnectPayload[] = [];
  const patterns = [
    /(?:setr?|set)\s+mysql_connection_string\s+["']([^"']+)["']/gi,
    /mysql_connection_string\s*[:=]\s*["']([^"']+)["']/gi,
    /connectionString\s*[:=]\s*["']([^"']+)["']/gi,
    /(mysql:\/\/[^\s"'`]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const parsed = parseConnectionValue(match[1]);
      if (parsed) found.push(parsed);
    }
    pattern.lastIndex = 0;
  }

  return found;
}

function dedupeConfigs(configs: DetectedSqlConfig[]): DetectedSqlConfig[] {
  const seen = new Set<string>();
  const result: DetectedSqlConfig[] = [];
  for (const config of configs) {
    const key = `${config.host}:${config.port}:${config.username}:${config.database ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(config);
  }
  return result;
}

export async function detectSqlFromProject(project: ProjectInfo): Promise<DetectedSqlConfig[]> {
  const configs: DetectedSqlConfig[] = [];
  const filesToScan: Array<{ path: string; label: string }> = [];

  if (project.serverCfgPath) {
    filesToScan.push({ path: project.serverCfgPath, label: "server.cfg" });
  }

  const extraPaths = [
    "resources/oxmysql/config.json",
    "resources/[oxmysql]/config.json",
    "oxmysql/config.json",
    "config/config.lua",
    "resources/qb-core/config.lua",
    "resources/[qb]/qb-core/config.lua",
  ];

  for (const relative of extraPaths) {
    filesToScan.push({ path: relative, label: relative });
  }

  for (const file of filesToScan) {
    try {
      const content = await readProjectFile(project, file.path);
      const parsed = extractFromText(content);
      parsed.forEach((entry, index) => {
        configs.push({
          ...entry,
          source: file.path,
          label: `${file.label}${parsed.length > 1 ? ` #${index + 1}` : ""}`,
        });
      });
    } catch {
      // optional files
    }
  }

  return dedupeConfigs(configs);
}