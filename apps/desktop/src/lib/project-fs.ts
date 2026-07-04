import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileNode, ProjectInfo } from "./tauri-fs";

export function isRemoteProject(project: ProjectInfo | null | undefined): boolean {
  return project?.source === "sftp";
}

export async function pickProjectFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Ouvrir un projet FiveM",
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function readProjectFile(
  project: ProjectInfo | null,
  path: string,
): Promise<string> {
  if (isRemoteProject(project)) {
    return invoke<string>("sftp_read_file", { path });
  }
  return invoke<string>("read_file", { path });
}

export async function saveProjectFile(
  project: ProjectInfo | null,
  path: string,
  content: string,
): Promise<void> {
  if (isRemoteProject(project)) {
    await invoke("sftp_write_file", { path, content });
    return;
  }
  await invoke("write_file", { path, content });
}

export async function fetchProjectTree(
  project: ProjectInfo | null,
  path: string,
): Promise<FileNode[]> {
  if (isRemoteProject(project)) {
    return invoke<FileNode[]>("sftp_list_project_tree", { path });
  }
  return invoke<FileNode[]>("list_project_tree", { path });
}

export async function fetchDirectory(
  project: ProjectInfo | null,
  path: string,
): Promise<FileNode[]> {
  if (isRemoteProject(project)) {
    return invoke<FileNode[]>("sftp_list_directory", { path });
  }
  return invoke<FileNode[]>("list_directory", { path });
}

export function mergeTreeChildren(
  nodes: FileNode[],
  dirPath: string,
  children: FileNode[],
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === dirPath) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: mergeTreeChildren(node.children, dirPath, children) };
    }
    return node;
  });
}

interface RawProjectInfo {
  rootPath: string;
  projectType: string;
  manifestPath?: string;
  serverCfgPath?: string;
  resources: string[];
}

export async function detectProject(path: string): Promise<ProjectInfo> {
  const info = await invoke<RawProjectInfo>("detect_project", { rootPath: path });
  return {
    ...info,
    projectType: info.projectType as ProjectInfo["projectType"],
    source: "local",
  };
}

export async function writeScaffold(
  project: ProjectInfo | null,
  rootPath: string,
  resourceName: string,
  files: Record<string, string>,
): Promise<string[]> {
  if (isRemoteProject(project)) {
    return invoke<string[]>("sftp_write_scaffold", { rootPath, resourceName, files });
  }
  return invoke<string[]>("write_scaffold", { rootPath, resourceName, files });
}

export async function disconnectProjectSession(project: ProjectInfo | null): Promise<void> {
  if (isRemoteProject(project)) {
    await invoke("sftp_disconnect");
  }
}