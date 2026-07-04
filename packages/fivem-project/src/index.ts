export { parseFxManifest } from "./fxmanifest.js";
export { buildScaffold, SCAFFOLD_OPTIONS } from "./scaffolds.js";
export {
  detectFramework,
  buildExportCompletions,
  getResourceNameFromPath,
} from "./framework.js";
export {
  buildResourceMetrics,
  parseResourcesFromServerCfg,
  parseResourceFromLogLine,
  summarizeResources,
} from "./resource-monitor.js";
export type { ResourceMetric, ResourceState } from "./resource-monitor.js";
export { analyzeMigration, applyMigrationHints } from "./migration.js";
export type { MigrationNote } from "./migration.js";
export {
  parseProfilerLogs,
  buildProfilerHistory,
  profilerHealth,
} from "./profiler.js";
export type { ProfilerSnapshot, ResourceProfile } from "./profiler.js";
export type {
  FiveMProject,
  FxManifest,
  ScaffoldKind,
  ScaffoldTemplate,
  FiveMFramework,
  FrameworkDetection,
  ExportCompletion,
} from "./types.js";