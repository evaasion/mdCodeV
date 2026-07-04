export interface ResourceProfile {
  name: string;
  memoryMb: number;
  tickMs: number;
  cpuScore: number;
  alerts: string[];
}

export interface ProfilerSnapshot {
  timestamp: number;
  resources: ResourceProfile[];
  serverHitchMs: number;
  totalMemoryMb: number;
}

const MEMORY_RE =
  /([a-zA-Z0-9_\-[\]]+)\s*(?:[:|]\s*|\s+)\s*([\d.]+)\s*(MiB|KiB|MB|KB)/i;
const TICK_RE = /([a-zA-Z0-9_\-[\]]+).*?([\d.]+)\s*ms/i;
const HITCH_RE = /hitch warning.*?(\d+)\s*milliseconds/i;
const RESMON_ROW_RE =
  /^\s*([a-zA-Z0-9_\-[\]]+)\s+([\d.]+)\s*(?:MiB|KiB)?\s+([\d.]+)\s*ms/i;

function toMb(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "kib" || u === "kb") return value / 1024;
  return value;
}

export function parseProfilerLogs(logs: string[]): ProfilerSnapshot {
  const resourceMap = new Map<string, ResourceProfile>();
  let serverHitchMs = 0;

  for (const line of logs) {
    const hitch = line.match(HITCH_RE);
    if (hitch?.[1]) {
      serverHitchMs = Math.max(serverHitchMs, Number(hitch[1]));
    }

    const resmon = line.match(RESMON_ROW_RE);
    if (resmon) {
      const name = resmon[1];
      const memoryMb = toMb(Number(resmon[2]), "MiB");
      const tickMs = Number(resmon[3]);
      upsertProfile(resourceMap, name, memoryMb, tickMs, line);
      continue;
    }

    const memory = line.match(MEMORY_RE);
    if (memory) {
      upsertProfile(
        resourceMap,
        memory[1],
        toMb(Number(memory[2]), memory[3]),
        0,
        line,
      );
    }

    const tick = line.match(TICK_RE);
    if (tick && !line.toLowerCase().includes("hitch")) {
      const existing = resourceMap.get(tick[1]);
      const tickMs = Number(tick[2]);
      if (existing) {
        existing.tickMs = Math.max(existing.tickMs, tickMs);
      } else {
        upsertProfile(resourceMap, tick[1], 0, tickMs, line);
      }
    }
  }

  const resources = [...resourceMap.values()]
    .map((resource) => finalizeProfile(resource))
    .sort((a, b) => b.cpuScore - a.cpuScore);

  const totalMemoryMb = resources.reduce((sum, r) => sum + r.memoryMb, 0);

  return {
    timestamp: Date.now(),
    resources,
    serverHitchMs,
    totalMemoryMb,
  };
}

function upsertProfile(
  map: Map<string, ResourceProfile>,
  name: string,
  memoryMb: number,
  tickMs: number,
  line: string,
) {
  const cleanName = name.replace(/^\[|\]$/g, "");
  const existing = map.get(cleanName) ?? {
    name: cleanName,
    memoryMb: 0,
    tickMs: 0,
    cpuScore: 0,
    alerts: [],
  };

  if (memoryMb > 0) existing.memoryMb = Math.max(existing.memoryMb, memoryMb);
  if (tickMs > 0) existing.tickMs = Math.max(existing.tickMs, tickMs);
  if (line.toLowerCase().includes("warning") || line.toLowerCase().includes("hitch")) {
    existing.alerts.push(line.slice(0, 120));
  }

  map.set(cleanName, existing);
}

function finalizeProfile(resource: ResourceProfile): ResourceProfile {
  const alerts = [...resource.alerts];
  if (resource.memoryMb >= 50) alerts.push(`Mémoire élevée: ${resource.memoryMb.toFixed(1)} MiB`);
  if (resource.tickMs >= 10) alerts.push(`Tick lent: ${resource.tickMs.toFixed(1)} ms`);

  return {
    ...resource,
    alerts: [...new Set(alerts)],
    cpuScore: resource.memoryMb * 1.5 + resource.tickMs * 2,
  };
}

export function buildProfilerHistory(
  logs: string[],
  maxSnapshots = 20,
): ProfilerSnapshot[] {
  const chunkSize = Math.max(30, Math.floor(logs.length / maxSnapshots));
  const snapshots: ProfilerSnapshot[] = [];

  for (let i = 0; i < logs.length; i += chunkSize) {
    const chunk = logs.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    snapshots.push(parseProfilerLogs(chunk));
  }

  return snapshots.slice(-maxSnapshots);
}

export function profilerHealth(snapshot: ProfilerSnapshot): "good" | "warn" | "critical" {
  if (snapshot.serverHitchMs >= 200) return "critical";
  if (snapshot.resources.some((r) => r.tickMs >= 15 || r.memoryMb >= 64)) return "critical";
  if (snapshot.serverHitchMs >= 100 || snapshot.resources.some((r) => r.tickMs >= 8)) {
    return "warn";
  }
  return "good";
}