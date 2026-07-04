import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSftpStatus,
  sshFetchLogs,
  sshSendConsoleCommand,
} from "../lib/remote";
import {
  buildRemoteConsoleTemplate,
  type RemoteServerSettings,
} from "../lib/settings";
import type { ServerLogLine } from "../lib/server";
import type { ProjectInfo } from "../lib/tauri-fs";

const MAX_LOG_LINES = 500;

function parseRemoteLogs(stdout: string): ServerLogLine[] {
  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => ({
      stream: line.toLowerCase().includes("error") ? "stderr" as const : "stdout" as const,
      text: line,
    }));
}

export function useRemoteServer(
  project: ProjectInfo | null,
  settings: RemoteServerSettings,
) {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<ServerLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const logsRef = useRef<ServerLogLine[]>([]);
  const hostLabel = project?.remoteHost ?? project?.remoteLabel ?? "VPS";

  const appendLog = useCallback((line: ServerLogLine) => {
    logsRef.current = [...logsRef.current, line].slice(-MAX_LOG_LINES);
    setLogs([...logsRef.current]);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSftpStatus();
      setConnected(status.connected);
      return status.connected;
    } catch {
      setConnected(false);
      return false;
    }
  }, []);

  const refreshLogs = useCallback(async () => {
    if (!settings.logFilePath.trim()) return;
    try {
      const result = await sshFetchLogs(settings.logFilePath, 150);
      const parsed = parseRemoteLogs(result.stdout);
      if (parsed.length > 0) {
        logsRef.current = parsed.slice(-MAX_LOG_LINES);
        setLogs([...logsRef.current]);
      }
      if (result.stderr.trim()) {
        appendLog({ stream: "stderr", text: result.stderr.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire les logs distants");
    }
  }, [appendLog, settings.logFilePath]);

  useEffect(() => {
    if (!project || project.source !== "sftp") {
      setConnected(false);
      return;
    }
    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [project, refreshStatus]);

  useEffect(() => {
    if (!project || project.source !== "sftp" || !connected || !settings.pollLogs) {
      setPolling(false);
      return;
    }

    setPolling(true);
    void refreshLogs();
    const timer = window.setInterval(() => {
      void refreshLogs();
    }, settings.logPollIntervalSec * 1000);

    return () => {
      window.clearInterval(timer);
      setPolling(false);
    };
  }, [
    connected,
    project,
    refreshLogs,
    settings.logPollIntervalSec,
    settings.pollLogs,
  ]);

  const sendCommand = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return;

      appendLog({ stream: "system", text: `> ${trimmed}` });
      setError(null);

      try {
        const template = buildRemoteConsoleTemplate(settings);
        const result = await sshSendConsoleCommand(trimmed, template);
        if (result.stdout.trim()) {
          for (const line of result.stdout.trim().split("\n")) {
            appendLog({ stream: "stdout", text: line });
          }
        }
        if (result.stderr.trim()) {
          for (const line of result.stderr.trim().split("\n")) {
            appendLog({ stream: "stderr", text: line });
          }
        }
        if (result.exitCode !== 0 && !result.stdout.trim() && !result.stderr.trim()) {
          setError(`Commande distante terminée avec le code ${result.exitCode}`);
        }
        if (settings.logFilePath.trim()) {
          window.setTimeout(() => void refreshLogs(), 600);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Commande SSH échouée");
      }
    },
    [appendLog, refreshLogs, settings],
  );

  const restartResource = useCallback(
    async (resourceName: string) => {
      if (!settings.liveReload) return;
      await sendCommand(`restart ${resourceName}`);
    },
    [sendCommand, settings.liveReload],
  );

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const ok = await refreshStatus();
    if (!ok) {
      setError("Session SSH inactive — reconnecte-toi via SFTP");
      return;
    }
    await refreshLogs();
    appendLog({
      stream: "system",
      text: `Console VPS active · ${hostLabel}`,
    });
  }, [appendLog, hostLabel, refreshLogs, refreshStatus]);

  const stop = useCallback(() => {
    appendLog({ stream: "system", text: "Polling logs distant en pause" });
  }, [appendLog]);

  return {
    running: connected,
    logs,
    fxBinary: connected ? `ssh://${hostLabel}` : null,
    error,
    polling,
    start,
    stop,
    sendCommand,
    restartResource,
    clearLogs,
    refreshLogs,
  };
}