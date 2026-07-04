export type ResourceState = "running" | "stopped" | "starting" | "error";

export interface ResourceMetric {
  name: string;
  state: ResourceState;
  lastEvent?: string;
  updatedAt: number;
}

const STARTED_RE = /(?:Started|started) resource\s+([^\s\]]+)/i;
const STOPPED_RE = /(?:Stopping|Stopped|stopped) resource\s+([^\s\]]+)/i;
const FAILED_RE = /Failed to (?:start|load) resource\s+([^\s\]]+)/i;
const ENSURE_RE = /ensure\s+([^\s;#]+)/gi;

export function parseResourcesFromServerCfg(serverCfg: string): string[] {
  const resources: string[] = [];
  for (const line of serverCfg.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    for (const match of trimmed.matchAll(ENSURE_RE)) {
      const name = match[1]?.replace(/['"]/g, "").trim();
      if (name && !resources.includes(name)) resources.push(name);
    }
  }
  return resources;
}

export function parseResourceFromLogLine(line: string): {
  name: string;
  state: ResourceState;
  event: string;
} | null {
  if (FAILED_RE.test(line)) {
    const match = line.match(FAILED_RE);
    if (match?.[1]) {
      return { name: match[1], state: "error", event: line };
    }
  }

  const started = line.match(STARTED_RE);
  if (started?.[1]) {
    return { name: started[1], state: "running", event: line };
  }

  const stopped = line.match(STOPPED_RE);
  if (stopped?.[1]) {
    return { name: stopped[1], state: "stopped", event: line };
  }

  if (/Restarting resource\s+([^\s]+)/i.test(line)) {
    const match = line.match(/Restarting resource\s+([^\s]+)/i);
    if (match?.[1]) {
      return { name: match[1], state: "starting", event: line };
    }
  }

  return null;
}

export function buildResourceMetrics(
  knownResources: string[],
  logs: string[],
): ResourceMetric[] {
  const map = new Map<string, ResourceMetric>();
  const now = Date.now();

  for (const name of knownResources) {
    map.set(name, { name, state: "stopped", updatedAt: now });
  }

  for (const line of logs) {
    const parsed = parseResourceFromLogLine(line);
    if (!parsed) continue;

    map.set(parsed.name, {
      name: parsed.name,
      state: parsed.state,
      lastEvent: parsed.event,
      updatedAt: now,
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeResources(metrics: ResourceMetric[]) {
  return metrics.reduce(
    (acc, metric) => {
      acc[metric.state] += 1;
      return acc;
    },
    { running: 0, stopped: 0, starting: 0, error: 0 },
  );
}