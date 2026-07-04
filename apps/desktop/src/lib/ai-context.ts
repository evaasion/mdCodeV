import type { ExportCompletion, FrameworkDetection } from "@mdcodev/fivem-project";
import type { LintDiagnostic } from "@mdcodev/linter-core";
import type { FileNode } from "./tauri-fs";
import type { ProjectInfo } from "./tauri-fs";
import { readProjectFile } from "./project-fs";
import type { AiSettings } from "./settings";

export interface EditorSelectionContext {
  text: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}

export interface AiRuntimeContext {
  project: ProjectInfo | null;
  framework: FrameworkDetection | null;
  tree: FileNode[];
  diagnostics: LintDiagnostic[];
  exportCompletions: ExportCompletion[];
  activeFileName: string | null;
  activeCode: string;
  selection: EditorSelectionContext | null;
}

const MAX_FILE_CHARS = 6000;
const MAX_CFG_CHARS = 2500;
const MAX_TREE_ENTRIES = 80;

function formatTree(nodes: FileNode[], depth = 0, count = { n: 0 }): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (count.n >= MAX_TREE_ENTRIES) break;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${node.isDir ? "📁" : "📄"} ${node.name}`);
    count.n += 1;
    if (node.isDir && node.children?.length) {
      lines.push(formatTree(node.children, depth + 1, count));
    }
  }
  return lines.filter(Boolean).join("\n");
}

function resolveFramework(
  settings: AiSettings,
  detection: FrameworkDetection | null,
): { framework: AiSettings["framework"]; source: string } {
  if (settings.useAutoFramework && detection?.framework) {
    return {
      framework: detection.framework,
      source: `auto (${detection.confidence}, ${detection.signals.slice(0, 3).join(", ") || "signaux projet"})`,
    };
  }
  return { framework: settings.framework, source: "manuel (paramètres)" };
}

export async function buildAiContextMessage(
  settings: AiSettings,
  runtime: AiRuntimeContext,
): Promise<string> {
  const parts: string[] = ["[Contexte mdcodeV]"];
  const { framework, source } = resolveFramework(settings, runtime.framework);

  parts.push(`Framework: ${framework} (${source})`);
  if (runtime.framework?.usesOxLib) {
    parts.push("ox_lib détecté dans le projet.");
  }

  if (runtime.project) {
    const projectLabel =
      runtime.project.rootPath.split(/[/\\]/).filter(Boolean).pop() ??
      runtime.project.rootPath;
    parts.push(
      `Projet: ${projectLabel} (${runtime.project.projectType}) @ ${runtime.project.rootPath}`,
    );
    if (runtime.project.resources.length > 0) {
      parts.push(`Resources: ${runtime.project.resources.slice(0, 30).join(", ")}`);
    }

    if (runtime.project.serverCfgPath) {
      try {
        const serverCfg = await readProjectFile(runtime.project, runtime.project.serverCfgPath);
        parts.push(
          `server.cfg (extrait):\n\`\`\`\n${serverCfg.slice(0, MAX_CFG_CHARS)}\n\`\`\``,
        );
      } catch {
        // ignore missing server.cfg
      }
    }

    if (runtime.project.manifestPath) {
      try {
        const manifest = await readProjectFile(runtime.project, runtime.project.manifestPath);
        parts.push(
          `fxmanifest.lua (extrait):\n\`\`\`lua\n${manifest.slice(0, MAX_CFG_CHARS)}\n\`\`\``,
        );
      } catch {
        // ignore missing manifest
      }
    }
  }

  if (runtime.tree.length > 0) {
    parts.push(`Arborescence projet:\n${formatTree(runtime.tree)}`);
  }

  if (runtime.exportCompletions.length > 0) {
    const exports = runtime.exportCompletions
      .slice(0, 25)
      .map((entry) => entry.label)
      .join(", ");
    parts.push(`Exports connus (ne pas inventer d'autres): ${exports}`);
  }

  if (runtime.diagnostics.length > 0) {
    const issues = runtime.diagnostics
      .slice(0, 12)
      .map((diag) => `L${diag.line} [${diag.severity}] ${diag.message}`)
      .join("\n");
    parts.push(`Diagnostics linter fichier actif:\n${issues}`);
  }

  if (runtime.activeFileName) {
    parts.push(`Fichier actif: ${runtime.activeFileName}`);
    parts.push(
      `Code actif:\n\`\`\`lua\n${runtime.activeCode.slice(0, MAX_FILE_CHARS)}\n\`\`\``,
    );
  }

  if (runtime.selection?.text.trim()) {
    parts.push(
      `Sélection (L${runtime.selection.startLine}-L${runtime.selection.endLine}):\n\`\`\`lua\n${runtime.selection.text.slice(0, 2000)}\n\`\`\``,
    );
  }

  return parts.join("\n\n");
}

export function resolveAiFramework(
  settings: AiSettings,
  detection: FrameworkDetection | null,
): AiSettings["framework"] {
  return resolveFramework(settings, detection).framework;
}