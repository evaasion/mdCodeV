import { useMemo } from "react";
import {
  buildProfilerHistory,
  parseProfilerLogs,
  profilerHealth,
  type ProfilerSnapshot,
} from "@mdcodev/fivem-project";
import type { ServerLogLine } from "../lib/server";

export function useProfiler(logs: ServerLogLine[]) {
  const logLines = useMemo(() => logs.map((line) => line.text), [logs]);

  const snapshot = useMemo(() => parseProfilerLogs(logLines), [logLines]);
  const history = useMemo(() => buildProfilerHistory(logLines, 16), [logLines]);
  const health = useMemo(() => profilerHealth(snapshot), [snapshot]);

  const topConsumers = useMemo(
    () => snapshot.resources.slice(0, 8),
    [snapshot],
  );

  return { snapshot, history, health, topConsumers };
}

export type { ProfilerSnapshot };