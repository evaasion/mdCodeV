import { useEffect, useMemo, useState } from "react";
import {
  buildResourceMetrics,
  parseResourcesFromServerCfg,
  summarizeResources,
  type ResourceMetric,
} from "@mdcodev/fivem-project";
import type { ServerLogLine } from "../lib/server";
import { readProjectFile } from "../lib/project-fs";
import type { ProjectInfo } from "../lib/tauri-fs";

export function useResourceMonitor(
  project: ProjectInfo | null,
  logs: ServerLogLine[],
  serverRunning: boolean,
) {
  const [knownResources, setKnownResources] = useState<string[]>([]);

  useEffect(() => {
    if (!project) {
      setKnownResources([]);
      return;
    }

    void (async () => {
      const names = new Set<string>(project.resources);

      if (project.serverCfgPath) {
        try {
          const cfg = await readProjectFile(project, project.serverCfgPath);
          for (const name of parseResourcesFromServerCfg(cfg)) {
            names.add(name);
          }
        } catch {
          // ignore
        }
      }

      setKnownResources([...names].sort());
    })();
  }, [project]);

  const logLines = useMemo(() => logs.map((line) => line.text), [logs]);

  const metrics = useMemo(
    () => buildResourceMetrics(knownResources, logLines),
    [knownResources, logLines],
  );

  const summary = useMemo(() => summarizeResources(metrics), [metrics]);

  return {
    metrics,
    summary,
    knownResources,
    refreshResmon: serverRunning,
  };
}

export type { ResourceMetric };