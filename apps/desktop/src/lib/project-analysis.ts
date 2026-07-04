import {
  detectFramework,
  buildExportCompletions,
  parseFxManifest,
  type ExportCompletion,
  type FrameworkDetection,
} from "@mdcodev/fivem-project";
import { readProjectFile } from "./project-fs";
import type { ProjectInfo } from "./tauri-fs";

export interface ProjectAnalysis {
  framework: FrameworkDetection;
  exportCompletions: ExportCompletion[];
  manifestName?: string;
}

export async function analyzeProject(project: ProjectInfo): Promise<ProjectAnalysis> {
  let serverCfg = "";
  let manifestContent = "";
  let codeSample = "";

  if (project.serverCfgPath) {
    try {
      serverCfg = await readProjectFile(project, project.serverCfgPath);
    } catch {
      serverCfg = "";
    }
  }

  if (project.manifestPath) {
    try {
      manifestContent = await readProjectFile(project, project.manifestPath);
      codeSample += manifestContent;
    } catch {
      manifestContent = "";
    }
  }

  const manifest = manifestContent ? parseFxManifest(manifestContent) : undefined;

  const framework = detectFramework({
    serverCfg,
    manifest,
    resources: project.resources,
    codeSample,
  });

  return {
    framework,
    exportCompletions: buildExportCompletions(framework),
    manifestName: manifest?.name,
  };
}