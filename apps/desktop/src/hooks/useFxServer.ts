import { useCallback, useEffect, useRef, useState } from "react";
import {
  findFxServerBinary,
  getServerStatus,
  listenServerLogs,
  listenServerStatus,
  sendServerCommand,
  startFxServer,
  stopFxServer,
  resolveServerRoot,
  type ServerLogLine,
} from "../lib/server";
import type { ServerSettings } from "../lib/settings";
import { isRemoteProject } from "../lib/project-fs";
import type { ProjectInfo } from "../lib/tauri-fs";

const MAX_LOG_LINES = 500;

export function useFxServer(project: ProjectInfo | null, settings: ServerSettings) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<ServerLogLine[]>([]);
  const [fxBinary, setFxBinary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logsRef = useRef<ServerLogLine[]>([]);

  const appendLog = useCallback((line: ServerLogLine) => {
    logsRef.current = [...logsRef.current, line].slice(-MAX_LOG_LINES);
    setLogs(logsRef.current);
  }, []);

  useEffect(() => {
    let unlistenLogs: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenLogs = await listenServerLogs(appendLog);
      unlistenStatus = await listenServerStatus(setRunning);
      const status = await getServerStatus();
      setRunning(status.running);
    })();

    return () => {
      unlistenLogs?.();
      unlistenStatus?.();
    };
  }, [appendLog]);

  useEffect(() => {
    if (!project || isRemoteProject(project)) {
      setFxBinary(null);
      return;
    }

    const root = resolveServerRoot(project);
    void (async () => {
      if (settings.fxServerPath) {
        setFxBinary(settings.fxServerPath);
        return;
      }
      const found = await findFxServerBinary(root);
      setFxBinary(found);
    })();
  }, [project, settings.fxServerPath]);

  const start = useCallback(async () => {
    if (!project) {
      setError("Ouvre un projet serveur FiveM d'abord");
      return;
    }

    if (isRemoteProject(project)) {
      setError("FXServer distant non disponible en Phase 5 — utilise un projet local");
      return;
    }

    setError(null);
    const serverRoot = resolveServerRoot(project);

    try {
      await startFxServer({
        serverRoot,
        fxserverPath: settings.fxServerPath || undefined,
        cfgFile: settings.cfgFile,
      });
      setRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de démarrer FXServer");
    }
  }, [project, settings.cfgFile, settings.fxServerPath]);

  const stop = useCallback(async () => {
    setError(null);
    try {
      await stopFxServer();
      setRunning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'arrêter FXServer");
    }
  }, []);

  const sendCommand = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    appendLog({ stream: "system", text: `> ${trimmed}` });
    try {
      await sendServerCommand(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commande échouée");
    }
  }, [appendLog]);

  const restartResource = useCallback(
    async (resourceName: string) => {
      if (!running || !settings.liveReload) return;
      await sendCommand(`restart ${resourceName}`);
    },
    [running, sendCommand, settings.liveReload],
  );

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return {
    running,
    logs,
    fxBinary,
    error,
    start,
    stop,
    sendCommand,
    restartResource,
    clearLogs,
  };
}