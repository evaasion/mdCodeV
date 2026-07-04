import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ServerLogLine {
  stream: "stdout" | "stderr" | "system";
  text: string;
}

export interface ServerStatus {
  running: boolean;
  serverRoot: string | null;
  pid: number | null;
}

interface RawServerStatus {
  running: boolean;
  serverRoot?: string;
  pid?: number;
}

interface RawServerLogLine {
  stream: string;
  text: string;
}

export async function findFxServerBinary(serverRoot: string): Promise<string | null> {
  return invoke<string | null>("find_fxserver_binary", { serverRoot });
}

export async function startFxServer(options: {
  serverRoot: string;
  fxserverPath?: string;
  cfgFile?: string;
}): Promise<void> {
  await invoke("start_fxserver", {
    serverRoot: options.serverRoot,
    fxserverPath: options.fxserverPath ?? null,
    cfgFile: options.cfgFile ?? null,
  });
}

export async function stopFxServer(): Promise<void> {
  await invoke("stop_fxserver");
}

export async function sendServerCommand(command: string): Promise<void> {
  await invoke("send_server_command", { command });
}

export async function getServerStatus(): Promise<ServerStatus> {
  const status = await invoke<RawServerStatus>("fxserver_status");
  return {
    running: status.running,
    serverRoot: status.serverRoot ?? null,
    pid: status.pid ?? null,
  };
}

export async function listenServerLogs(
  onLine: (line: ServerLogLine) => void,
): Promise<UnlistenFn> {
  return listen<RawServerLogLine>("server-log", (event) => {
    const stream = event.payload.stream as ServerLogLine["stream"];
    onLine({
      stream: stream ?? "stdout",
      text: event.payload.text,
    });
  });
}

export async function listenServerStatus(
  onStatus: (running: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>("server-status", (event) => {
    onStatus(event.payload);
  });
}

export function resolveServerRoot(project: {
  rootPath: string;
  projectType: string;
  serverCfgPath?: string;
}): string {
  if (project.projectType === "server") return project.rootPath;
  if (project.serverCfgPath) {
    const parts = project.serverCfgPath.replace(/\\/g, "/").split("/");
    parts.pop();
    return parts.join("/");
  }
  return project.rootPath;
}