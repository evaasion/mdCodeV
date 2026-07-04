import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export type ProjectSource = "local" | "sftp";

export interface ProjectInfo {
  rootPath: string;
  projectType: "resource" | "server" | "unknown";
  manifestPath?: string;
  serverCfgPath?: string;
  resources: string[];
  source: ProjectSource;
  remoteHost?: string;
  remoteLabel?: string;
}

interface RawFileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: RawFileNode[];
}

interface RawProjectInfo {
  rootPath: string;
  projectType: string;
  manifestPath?: string;
  serverCfgPath?: string;
  resources: string[];
}

function mapNode(node: RawFileNode): FileNode {
  return {
    name: node.name,
    path: node.path,
    isDir: node.isDir,
    children: node.children?.map(mapNode),
  };
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

export async function readProjectFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function saveProjectFile(path: string, content: string): Promise<void> {
  await invoke("write_file", { path, content });
}

export async function fetchProjectTree(path: string): Promise<FileNode[]> {
  const nodes = await invoke<RawFileNode[]>("list_project_tree", { path });
  return nodes.map(mapNode);
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
  rootPath: string,
  resourceName: string,
  files: Record<string, string>,
): Promise<string[]> {
  return invoke<string[]>("write_scaffold", { rootPath, resourceName, files });
}