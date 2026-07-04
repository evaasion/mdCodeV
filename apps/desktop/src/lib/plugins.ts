import { invoke } from "@tauri-apps/api/core";
import { parsePluginManifest, type LoadedPlugin } from "@mdcodev/plugin-core";
import { isRemoteProject } from "./project-fs";
import type { ProjectInfo } from "./tauri-fs";

interface PluginFile {
  path: string;
  name: string;
}

async function readLocalPluginFiles(projectPath?: string): Promise<PluginFile[]> {
  await invoke<string[]>("ensure_plugins_dir", {
    projectPath: projectPath ?? null,
  });
  return invoke<PluginFile[]>("list_plugin_files", {
    projectPath: projectPath ?? null,
  });
}

async function readRemotePluginFiles(projectPath: string): Promise<PluginFile[]> {
  await invoke<string[]>("sftp_ensure_plugins_dir", {
    projectPath,
  });
  return invoke<PluginFile[]>("sftp_list_plugin_files", {
    projectPath,
  });
}

async function parsePluginFiles(
  files: PluginFile[],
  readFile: (path: string) => Promise<string>,
): Promise<LoadedPlugin[]> {
  const plugins: LoadedPlugin[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(file.path);
      plugins.push(parsePluginManifest(raw, file.path));
    } catch {
      // skip invalid plugin manifests
    }
  }
  return plugins;
}

export async function loadPlugins(
  project: ProjectInfo | null,
  options?: { loadGlobal?: boolean; loadProject?: boolean },
): Promise<LoadedPlugin[]> {
  const loadGlobal = options?.loadGlobal ?? true;
  const loadProject = options?.loadProject ?? true;
  const plugins: LoadedPlugin[] = [];

  if (loadGlobal) {
    const globalFiles = await readLocalPluginFiles();
    plugins.push(
      ...(await parsePluginFiles(globalFiles, (path) =>
        invoke<string>("read_plugin_file", { path }),
      )),
    );
  }

  if (loadProject && project) {
    if (isRemoteProject(project)) {
      const remoteFiles = await readRemotePluginFiles(project.rootPath);
      plugins.push(
        ...(await parsePluginFiles(remoteFiles, (path) =>
          invoke<string>("sftp_read_file", { path }),
        )),
      );
    } else {
      const localProjectFiles = await readLocalPluginFiles(project.rootPath);
      const globalPaths = new Set(
        (loadGlobal ? await readLocalPluginFiles() : []).map((file) => file.path),
      );
      const projectOnly = localProjectFiles.filter((file) => !globalPaths.has(file.path));
      plugins.push(
        ...(await parsePluginFiles(projectOnly, (path) =>
          invoke<string>("read_plugin_file", { path }),
        )),
      );
    }
  }

  return plugins;
}