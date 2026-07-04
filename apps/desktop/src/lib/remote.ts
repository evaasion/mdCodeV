import { invoke } from "@tauri-apps/api/core";
import type { FileNode, ProjectInfo } from "./tauri-fs";
import type { SftpConnectPayload } from "./remote-settings";

export interface SftpStatus {
  connected: boolean;
  host?: string;
  username?: string;
  port?: number;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface RawProjectInfo {
  rootPath: string;
  projectType: string;
  manifestPath?: string;
  serverCfgPath?: string;
  resources: string[];
}

interface RawSshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function mapExecResult(result: RawSshExecResult): SshExecResult {
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

function toProjectInfo(info: RawProjectInfo, host: string, label?: string): ProjectInfo {
  return {
    rootPath: info.rootPath,
    projectType: info.projectType as ProjectInfo["projectType"],
    manifestPath: info.manifestPath,
    serverCfgPath: info.serverCfgPath,
    resources: info.resources,
    source: "sftp",
    remoteHost: host,
    remoteLabel: label,
  };
}

export async function connectSftp(payload: SftpConnectPayload): Promise<SftpStatus> {
  return invoke<SftpStatus>("sftp_connect", {
    config: {
      host: payload.host,
      port: payload.port,
      username: payload.username,
      authType: payload.authType,
      password: payload.password ?? null,
      privateKeyPath: payload.privateKeyPath ?? null,
      passphrase: payload.passphrase ?? null,
    },
  });
}

export async function disconnectSftp(): Promise<void> {
  await invoke("sftp_disconnect");
}

export async function getSftpStatus(): Promise<SftpStatus> {
  return invoke<SftpStatus>("sftp_status");
}

export async function listRemoteDirectory(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("sftp_list_directory", { path });
}

export async function detectRemoteProject(
  rootPath: string,
  host: string,
  label?: string,
): Promise<ProjectInfo> {
  const info = await invoke<RawProjectInfo>("sftp_detect_project", { rootPath });
  return toProjectInfo(info, host, label);
}

export async function sshExec(command: string): Promise<SshExecResult> {
  const result = await invoke<RawSshExecResult>("ssh_exec", { command });
  return mapExecResult(result);
}

export async function sshSendConsoleCommand(
  command: string,
  template: string,
): Promise<SshExecResult> {
  const result = await invoke<RawSshExecResult>("ssh_send_console_command", {
    command,
    template,
  });
  return mapExecResult(result);
}

export async function sshFetchLogs(
  logPath: string,
  lines?: number,
): Promise<SshExecResult> {
  const result = await invoke<RawSshExecResult>("ssh_fetch_logs", {
    logPath,
    lines: lines ?? null,
  });
  return mapExecResult(result);
}