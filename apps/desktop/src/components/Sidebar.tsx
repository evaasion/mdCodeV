import type { NativeFunction } from "@mdcodev/natives-core";
import type { LoadedPlugin } from "@mdcodev/plugin-core";
import type { FrameworkDetection } from "@mdcodev/fivem-project";
import type { MarketplaceTemplate } from "@mdcodev/marketplace";
import type { FileNode, ProjectInfo } from "../lib/tauri-fs";
import { FileExplorer } from "./FileExplorer";
import { NativesExplorer } from "./NativesExplorer";
import { MarketplacePanel } from "./MarketplacePanel";
import { PluginsPanel } from "./PluginsPanel";
import { SqlExplorerPanel } from "./SqlExplorerPanel";
import type { SqlSchemaDatabase } from "../hooks/useSqlDatabase";
import type { SqlStatus } from "../lib/sql";
import type { SqlSelectContext } from "../lib/sql-query-utils";
import styles from "./Sidebar.module.css";

export type SidebarTab = "explorer" | "sql" | "natives" | "marketplace" | "plugins";

interface SidebarProps {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  natives: NativeFunction[];
  namespaces: string[];
  selectedNative: NativeFunction | null;
  onSelectNative: (native: NativeFunction) => void;
  onInsertNative: (native: NativeFunction) => void;
  project: ProjectInfo | null;
  framework: FrameworkDetection | null;
  tree: FileNode[];
  treeLoading: boolean;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenProject: () => void;
  onOpenRemote: () => void;
  onRefresh: () => void;
  onExpandDirectory: (path: string) => Promise<void>;
  onInstallTemplate: (template: MarketplaceTemplate) => Promise<void>;
  catalogVersion: number;
  catalogUrl: string;
  onCloudSync: () => Promise<void>;
  plugins: LoadedPlugin[];
  pluginsLoading: boolean;
  pluginsError: string | null;
  onRefreshPlugins: () => void;
  onTogglePlugin: (pluginId: string) => void;
  onPluginCommand: (command: string) => void;
  sqlStatus: SqlStatus;
  sqlDatabases: SqlSchemaDatabase[];
  sqlSchemaLoading: boolean;
  sqlSelectContext: SqlSelectContext | null;
  onSqlConnect: () => void;
  onSqlDisconnect: () => void;
  onSqlRefreshSchema: () => void;
  onSqlLoadTables: (database: string) => void;
  onSqlPreviewTable: (database: string, table: string) => void;
  onSqlDescribeTable: (database: string, table: string) => void;
  onSqlOpenTableTools: (database: string, table: string) => void;
}

export function Sidebar({
  tab,
  onTabChange,
  natives,
  namespaces,
  selectedNative,
  onSelectNative,
  onInsertNative,
  project,
  framework,
  tree,
  treeLoading,
  activePath,
  onOpenFile,
  onOpenProject,
  onOpenRemote,
  onRefresh,
  onExpandDirectory,
  onInstallTemplate,
  catalogVersion,
  catalogUrl,
  onCloudSync,
  plugins,
  pluginsLoading,
  pluginsError,
  onRefreshPlugins,
  onTogglePlugin,
  onPluginCommand,
  sqlStatus,
  sqlDatabases,
  sqlSchemaLoading,
  sqlSelectContext,
  onSqlConnect,
  onSqlDisconnect,
  onSqlRefreshSchema,
  onSqlLoadTables,
  onSqlPreviewTable,
  onSqlDescribeTable,
  onSqlOpenTableTools,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        <button
          className={tab === "explorer" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("explorer")}
        >
          Explorer
        </button>
        <button
          className={tab === "sql" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("sql")}
        >
          SQL
        </button>
        <button
          className={tab === "marketplace" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("marketplace")}
        >
          Market
        </button>
        <button
          className={tab === "plugins" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("plugins")}
        >
          Plugins
        </button>
        <button
          className={tab === "natives" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("natives")}
        >
          Natives
        </button>
      </div>
      <div className={styles.content}>
        {tab === "explorer" && (
          <FileExplorer
            project={project}
            framework={framework}
            tree={tree}
            activePath={activePath}
            onOpenFile={onOpenFile}
            onOpenProject={onOpenProject}
            onOpenRemote={onOpenRemote}
            onRefresh={onRefresh}
            onExpandDirectory={onExpandDirectory}
            loading={treeLoading}
          />
        )}
        {tab === "sql" && (
          <SqlExplorerPanel
            status={sqlStatus}
            databases={sqlDatabases}
            schemaLoading={sqlSchemaLoading}
            selectContext={sqlSelectContext}
            onConnect={onSqlConnect}
            onDisconnect={onSqlDisconnect}
            onRefresh={onSqlRefreshSchema}
            onLoadTables={onSqlLoadTables}
            onPreviewTable={onSqlPreviewTable}
            onDescribeTable={onSqlDescribeTable}
            onOpenTableTools={onSqlOpenTableTools}
          />
        )}
        {tab === "marketplace" && (
          <MarketplacePanel
            onInstall={onInstallTemplate}
            disabled={!project}
            catalogVersion={catalogVersion}
            catalogUrl={catalogUrl}
            onCloudSync={onCloudSync}
          />
        )}
        {tab === "plugins" && (
          <PluginsPanel
            plugins={plugins}
            loading={pluginsLoading}
            error={pluginsError}
            onRefresh={onRefreshPlugins}
            onToggle={onTogglePlugin}
            onRunCommand={onPluginCommand}
          />
        )}
        {tab === "natives" && (
          <NativesExplorer
            natives={natives}
            namespaces={namespaces}
            selectedNative={selectedNative}
            onSelect={onSelectNative}
            onInsert={onInsertNative}
          />
        )}
      </div>
    </aside>
  );
}