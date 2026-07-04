export interface PluginCommand {
  id: string;
  label: string;
  command: string;
}

export interface PluginLintRule {
  id: string;
  pattern: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface PluginCompletion {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
}

export interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  files: Record<string, string>;
}

export interface MdcodevPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  hooks?: {
    lintRules?: PluginLintRule[];
    completions?: PluginCompletion[];
    templates?: PluginTemplate[];
    commands?: PluginCommand[];
  };
}

export interface LoadedPlugin extends MdcodevPluginManifest {
  sourcePath: string;
  enabled: boolean;
}