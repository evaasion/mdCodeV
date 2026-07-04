export interface FxManifest {
  fxVersion?: string;
  game?: string;
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  clientScripts: string[];
  serverScripts: string[];
  sharedScripts: string[];
  files: string[];
  dependencies: string[];
  lua54?: boolean;
}

export interface FiveMProject {
  rootPath: string;
  type: "resource" | "server";
  manifestPath?: string;
  manifest?: FxManifest;
  serverCfgPath?: string;
  resources: string[];
}

export type FiveMFramework = "qbcore" | "qbox" | "esx" | "standalone";

export interface FrameworkDetection {
  framework: FiveMFramework;
  confidence: "high" | "medium" | "low";
  signals: string[];
  usesOxLib: boolean;
}

export interface ExportCompletion {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
  sortText: string;
}

export type ScaffoldKind = "resource-basic" | "job-qbcore" | "shop-ox" | "hud-nui";

export interface ScaffoldTemplate {
  kind: ScaffoldKind;
  label: string;
  description: string;
  files: Record<string, string>;
}