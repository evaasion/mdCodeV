import type {
  LoadedPlugin,
  MdcodevPluginManifest,
  PluginCompletion,
  PluginLintRule,
} from "./types.js";

export type {
  LoadedPlugin,
  MdcodevPluginManifest,
  PluginCommand,
  PluginCompletion,
  PluginLintRule,
  PluginTemplate,
} from "./types.js";

export function parsePluginManifest(raw: string, sourcePath: string): LoadedPlugin {
  const manifest = JSON.parse(raw) as MdcodevPluginManifest;
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error(`Plugin invalide: ${sourcePath}`);
  }
  return { ...manifest, sourcePath, enabled: true };
}

export function mergePluginCompletions(plugins: LoadedPlugin[]): PluginCompletion[] {
  const results: PluginCompletion[] = [];
  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    for (const completion of plugin.hooks?.completions ?? []) {
      results.push(completion);
    }
  }
  return results;
}

export function runPluginLintRules(
  plugins: LoadedPlugin[],
  code: string,
): Array<{
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
}> {
  const diagnostics: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning" | "info";
    rule: string;
  }> = [];

  const lines = code.split("\n");

  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    for (const rule of plugin.hooks?.lintRules ?? []) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(rule.pattern, "gi");
      } catch {
        continue;
      }

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          diagnostics.push({
            line: index + 1,
            column: 1,
            message: `[${plugin.name}] ${rule.message}`,
            severity: rule.severity,
            rule: `plugin/${plugin.id}/${rule.id}`,
          });
        }
        pattern.lastIndex = 0;
      });
    }
  }

  return diagnostics;
}