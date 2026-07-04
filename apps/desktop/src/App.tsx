import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAppearanceTheme,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
} from "./lib/appearance";
import type { NativeFunction } from "@mdcodev/natives-core";
import { createNativeIndex } from "@mdcodev/natives-core";
import nativesData from "@mdcodev/natives-core/data";
import type { LintDiagnostic } from "@mdcodev/linter-core";
import {
  getResourceNameFromPath,
  type ExportCompletion,
  type FrameworkDetection,
} from "@mdcodev/fivem-project";
import type { MarketplaceTemplate } from "@mdcodev/marketplace";
import { TitleBar } from "./components/TitleBar";
import { Sidebar, type SidebarTab } from "./components/Sidebar";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { NativeDetail } from "./components/NativeDetail";
import { AgentPanel } from "./components/AgentPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ScaffoldModal } from "./components/ScaffoldModal";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { ResourceMonitorPanel } from "./components/ResourceMonitorPanel";
import { ProfilerPanel } from "./components/ProfilerPanel";
import { MigrationPanel } from "./components/MigrationPanel";
import { RemoteConnectModal } from "./components/RemoteConnectModal";
import { SqlConnectModal } from "./components/SqlConnectModal";
import { SqlImportModal } from "./components/SqlImportModal";
import { SqlTableToolsModal } from "./components/SqlTableToolsModal";
import {
  AiWriteDiffModal,
  type AiWriteDiffRequest,
} from "./components/AiWriteDiffModal";
import { DatabasePanel } from "./components/DatabasePanel";
import { StatusBar } from "./components/StatusBar";
import { DEFAULT_LUA } from "./lib/defaults";
import {
  createTabFromFile,
  createUntitledTab,
  type EditorTab,
} from "./lib/editor";
import {
  addTabToFocusedGroup,
  closeTabInGroup,
  createInitialWorkspace,
  duplicateActiveTabInSplit,
  findGroupForTab,
  getFocusedActiveTabId,
  setGroupActiveTab,
  type EditorWorkspaceLayout,
} from "./lib/editor-layout";
import {
  detectProject,
  disconnectProjectSession,
  fetchDirectory,
  fetchProjectTree,
  mergeTreeChildren,
  isRemoteProject,
  pickProjectFolder,
  readProjectFile,
  saveProjectFile,
  writeScaffold,
} from "./lib/project-fs";
import type { FileNode, ProjectInfo } from "./lib/tauri-fs";
import {
  getMergedCatalogFromCache,
  setMarketplaceCatalog,
  syncCloudCatalog,
} from "@mdcodev/marketplace";
import {
  loadAiSettings,
  loadCloudSettings,
  loadPlatformSettings,
  loadPluginSettings,
  loadRemoteServerSettings,
  loadServerSettings,
  saveAiSettings,
  saveCloudSettings,
  savePlatformSettings,
  savePluginSettings,
  saveRemoteServerSettings,
  saveServerSettings,
  type AiSettings,
  type CloudSettings,
  type PlatformSettings,
  type PluginSettings,
  type RemoteServerSettings,
  type ServerSettings,
} from "./lib/settings";
import { analyzeProject } from "./lib/project-analysis";
import { setExportCompletions, setPluginCompletions } from "./lib/monaco-lua";
import { launchFiveMConnect } from "./lib/game";
import { useLint } from "./hooks/useLint";
import { useServerConsole } from "./hooks/useServerConsole";
import { useResourceMonitor } from "./hooks/useResourceMonitor";
import { useProfiler } from "./hooks/useProfiler";
import { usePlugins } from "./hooks/usePlugins";
import { useSqlDatabase } from "./hooks/useSqlDatabase";
import { parseSelectContext } from "./lib/sql-query-utils";
import { formatTablePreviewQuery } from "./lib/sql";
import type { EditorSelectionContext } from "./lib/ai-context";
import {
  deleteAiKeychainKey,
  getAiKeychainKey,
  saveAiKeychainKey,
} from "./lib/ai-keychain";
import {
  createDefaultReadFile,
  createDefaultWriteFile,
  defaultListDirectory,
  resolveProjectPath,
  toolConfirmMessage,
  type AiToolHandlers,
} from "./lib/ai-tools";
import { loadSqlSettings, saveSqlSettings, type SqlSettings } from "./lib/sql-settings";
import type { SqlSelectContext } from "./lib/sql-query-utils";
import {
  bindResizeDrag,
  clampPanel,
  loadPanelLayout,
  PANEL_LIMITS,
  savePanelLayout,
  type PanelLayout,
} from "./lib/panel-layout";
import styles from "./App.module.css";

type RightPanel = "native" | "agent" | null;
type BottomPanel = "terminal" | "database" | "resources" | "profiler" | "problems" | "migration" | null;

const INITIAL_EDITOR_TAB = createUntitledTab(DEFAULT_LUA);
const INITIAL_WORKSPACE = createInitialWorkspace(INITIAL_EDITOR_TAB.id);

export default function App() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("explorer");
  const [selectedNative, setSelectedNative] = useState<NativeFunction | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("terminal");
  const [showSettings, setShowSettings] = useState(false);
  const [showScaffold, setShowScaffold] = useState(false);
  const [showRemoteConnect, setShowRemoteConnect] = useState(false);
  const [showSqlConnect, setShowSqlConnect] = useState(false);
  const [showSqlImport, setShowSqlImport] = useState(false);
  const [sqlTableTools, setSqlTableTools] = useState<{ database: string; table: string } | null>(
    null,
  );
  const [sqlQuery, setSqlQuery] = useState("SELECT 1;");
  const [sqlSelectContext, setSqlSelectContext] = useState<SqlSelectContext | null>(null);
  const [sqlSettings, setSqlSettings] = useState<SqlSettings>(() => loadSqlSettings());
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [serverSettings, setServerSettings] = useState<ServerSettings>(() => loadServerSettings());
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => loadPlatformSettings());
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>(() => loadCloudSettings());
  const [pluginSettings, setPluginSettings] = useState<PluginSettings>(() => loadPluginSettings());
  const [remoteServerSettings, setRemoteServerSettings] = useState<RemoteServerSettings>(() =>
    loadRemoteServerSettings(),
  );
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(() =>
    loadAppearanceSettings(),
  );
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => loadPanelLayout());
  const panelLayoutRef = useRef(panelLayout);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [frameworkDetection, setFrameworkDetection] = useState<FrameworkDetection | null>(null);
  const [exportCompletions, setExportCompletionsState] = useState<ExportCompletion[]>([]);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [tabs, setTabs] = useState<EditorTab[]>([INITIAL_EDITOR_TAB]);
  const [workspace, setWorkspace] = useState<EditorWorkspaceLayout>(INITIAL_WORKSPACE);
  const [revealLine, setRevealLine] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<string | null>(null);
  const [playState, setPlayState] = useState<string | null>(null);
  const [editorSelection, setEditorSelection] = useState<EditorSelectionContext | null>(null);
  const [writeDiffRequest, setWriteDiffRequest] = useState<AiWriteDiffRequest | null>(null);
  const writeDiffResolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    panelLayoutRef.current = panelLayout;
  }, [panelLayout]);

  useEffect(() => {
    void (async () => {
      const settings = loadAiSettings();
      if (!settings.rememberApiKey) return;
      try {
        const apiKey = await getAiKeychainKey(settings.provider);
        if (apiKey) {
          setAiSettings({ ...settings, apiKey });
        }
      } catch {
        // keychain unavailable
      }
    })();
  }, []);

  const persistPanelLayout = useCallback(() => {
    savePanelLayout(panelLayoutRef.current);
  }, []);

  const startSidebarResize = useCallback(
    (event: React.MouseEvent) => {
      const startX = event.clientX;
      const startWidth = panelLayoutRef.current.sidebarWidth;
      bindResizeDrag(
        event,
        "col-resize",
        (moveEvent) => {
          setPanelLayout((prev) => ({
            ...prev,
            sidebarWidth: clampPanel(
              startWidth + (moveEvent.clientX - startX),
              PANEL_LIMITS.sidebar.min,
              PANEL_LIMITS.sidebar.max,
            ),
          }));
        },
        persistPanelLayout,
      );
    },
    [persistPanelLayout],
  );

  const startBottomResize = useCallback(
    (event: React.MouseEvent) => {
      const startY = event.clientY;
      const startHeight = panelLayoutRef.current.bottomPanelHeight;
      bindResizeDrag(
        event,
        "row-resize",
        (moveEvent) => {
          setPanelLayout((prev) => ({
            ...prev,
            bottomPanelHeight: clampPanel(
              startHeight - (moveEvent.clientY - startY),
              PANEL_LIMITS.bottom.min,
              PANEL_LIMITS.bottom.max,
            ),
          }));
        },
        persistPanelLayout,
      );
    },
    [persistPanelLayout],
  );

  const startDetailResize = useCallback(
    (event: React.MouseEvent) => {
      const startX = event.clientX;
      const startWidth = panelLayoutRef.current.detailWidth;
      bindResizeDrag(
        event,
        "col-resize",
        (moveEvent) => {
          setPanelLayout((prev) => ({
            ...prev,
            detailWidth: clampPanel(
              startWidth - (moveEvent.clientX - startX),
              PANEL_LIMITS.detail.min,
              PANEL_LIMITS.detail.max,
            ),
          }));
        },
        persistPanelLayout,
      );
    },
    [persistPanelLayout],
  );

  const nativeIndex = useMemo(() => createNativeIndex(nativesData), []);
  const knownNatives = useMemo(
    () => new Set(nativesData.natives.map((native) => native.luaName)),
    [],
  );

  const activeTabId = getFocusedActiveTabId(workspace);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const tabMap = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab])), [tabs]);
  const pluginsState = usePlugins(project, pluginSettings);
  const sqlDatabase = useSqlDatabase(sqlSettings);
  const { diagnostics, counts } = useLint(
    activeTab,
    knownNatives,
    frameworkDetection,
    pluginsState.plugins,
  );
  const serverConsole = useServerConsole(project, serverSettings, remoteServerSettings);
  const resourceMonitor = useResourceMonitor(
    project,
    serverConsole.logs,
    serverConsole.running,
  );
  const profiler = useProfiler(serverConsole.logs);

  const platformLabel =
    platformSettings.platform === "gta6" ? "GTA VI Preview" : "FiveM";

  const projectDisplayName = project
    ? isRemoteProject(project)
      ? `${project.remoteLabel ?? project.remoteHost ?? "SFTP"}:${project.rootPath.split("/").pop()}`
      : (project.rootPath.split(/[/\\]/).pop() ?? null)
    : null;

  const canPlayLocal = !!project && !isRemoteProject(project);

  useEffect(() => {
    setExportCompletions(exportCompletions);
  }, [exportCompletions]);

  useEffect(() => {
    setPluginCompletions(pluginsState.plugins);
  }, [pluginsState.plugins]);

  const syncCloud = useCallback(async () => {
    const result = await syncCloudCatalog(cloudSettings.catalogUrl);
    setMarketplaceCatalog(result.catalog);
    setCatalogVersion((v) => v + 1);
    setSaveState(`Cloud sync · +${result.added} templates`);
  }, [cloudSettings.catalogUrl]);

  useEffect(() => {
    if (cloudSettings.autoSyncOnStart) {
      void syncCloud().catch(() => {
        const cached = getMergedCatalogFromCache();
        if (cached) {
          setMarketplaceCatalog(cached);
          setCatalogVersion((v) => v + 1);
        }
      });
      return;
    }

    const cached = getMergedCatalogFromCache();
    if (cached) {
      setMarketplaceCatalog(cached);
      setCatalogVersion((v) => v + 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshTree = useCallback(async (info: ProjectInfo) => {
    setTreeLoading(true);
    try {
      const nodes = await fetchProjectTree(info, info.rootPath);
      setTree(nodes);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const expandDirectory = useCallback(
    async (path: string) => {
      if (!project) return;
      const children = await fetchDirectory(project, path);
      setTree((prev) => mergeTreeChildren(prev, path, children));
    },
    [project],
  );

  const loadProjectAnalysis = useCallback(async (info: ProjectInfo) => {
    const analysis = await analyzeProject(info);
    setFrameworkDetection(analysis.framework);
    setExportCompletionsState(analysis.exportCompletions);
  }, []);

  const openProject = useCallback(async () => {
    const folder = await pickProjectFolder();
    if (!folder) return;

    if (project) {
      await disconnectProjectSession(project);
    }

    const info = await detectProject(folder);
    setProject(info);
    setSidebarTab("explorer");
    await refreshTree(info);
    await loadProjectAnalysis(info);
  }, [loadProjectAnalysis, project, refreshTree]);

  const openRemoteProject = useCallback(
    async (info: ProjectInfo) => {
      if (project) {
        await disconnectProjectSession(project);
      }

      setProject(info);
      setSidebarTab("explorer");
      await refreshTree(info);
      await loadProjectAnalysis(info);
      setSaveState(`SFTP · ${info.remoteHost ?? "VPS"}`);
    },
    [loadProjectAnalysis, project, refreshTree],
  );

  const openFile = useCallback(
    async (path: string) => {
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        const groupId = findGroupForTab(workspace, existing.id);
        if (groupId) {
          setWorkspace((prev) => setGroupActiveTab(prev, groupId, existing.id));
        } else {
          setWorkspace((prev) => addTabToFocusedGroup(prev, existing.id));
        }
        return;
      }

      try {
        const content = await readProjectFile(project, path);
        const tab = createTabFromFile(path, content);
        setTabs((prev) => [...prev, tab]);
        setWorkspace((prev) => addTabToFocusedGroup(prev, tab.id));
      } catch (err) {
        setSaveState(err instanceof Error ? err.message : "Impossible d'ouvrir le fichier");
      }
    },
    [project, tabs, workspace],
  );

  const confirmAiToolAction = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      if (!aiSettings.confirmToolActions) return true;

      if (name === "write_project_file") {
        const path = String(args.path ?? "");
        const newContent = String(args.content ?? "");
        const resolved = resolveProjectPath(project, path);
        if (!resolved) return false;

        let oldContent = "";
        try {
          oldContent = await readProjectFile(project, resolved);
        } catch {
          oldContent = "";
        }

        if (oldContent === newContent) return true;

        const root = project?.rootPath.replace(/\\/g, "/").replace(/\/+$/, "") ?? "";
        const displayPath =
          root && resolved.replace(/\\/g, "/").startsWith(root)
            ? resolved.replace(/\\/g, "/").slice(root.length + 1)
            : resolved;

        return new Promise<boolean>((resolve) => {
          writeDiffResolverRef.current = resolve;
          setWriteDiffRequest({
            path: resolved,
            displayPath,
            oldContent,
            newContent,
          });
        });
      }

      return window.confirm(toolConfirmMessage(name, args));
    },
    [aiSettings.confirmToolActions, project],
  );

  const resolveWriteDiff = useCallback((approved: boolean) => {
    writeDiffResolverRef.current?.(approved);
    writeDiffResolverRef.current = null;
    setWriteDiffRequest(null);
  }, []);

  const aiToolHandlers = useMemo<AiToolHandlers>(
    () => ({
      project,
      readFile: createDefaultReadFile(project),
      writeFile: createDefaultWriteFile(project),
      listDirectory: (path) => defaultListDirectory(project, path),
      sqlQuery: async (sql) => {
        if (!sqlDatabase.status.connected) {
          return "MySQL non connecté. Utilise l'onglet SQL pour te connecter.";
        }
        try {
          const result = await sqlDatabase.executeQuery(sql);
          if (!result) return "Requête annulée ou refusée.";
          if (result.columns.length > 0) {
            return JSON.stringify({
              columns: result.columns,
              rows: result.rows.slice(0, 30),
              rowCount: result.rows.length,
              truncated: result.truncated,
              executionTimeMs: result.executionTimeMs,
            });
          }
          return `${result.affectedRows} ligne(s) affectée(s)`;
        } catch (err) {
          return `Erreur SQL: ${err instanceof Error ? err.message : "inconnue"}`;
        }
      },
      restartResource: async (resource) => {
        if (!serverConsole.running) return "Serveur non démarré.";
        await serverConsole.sendCommand(`restart ${resource}`);
        return `Commande restart ${resource} envoyée`;
      },
      sendServerCommand: async (command) => {
        if (!serverConsole.running) return "Serveur non démarré.";
        await serverConsole.sendCommand(command);
        return `Commande envoyée: ${command}`;
      },
      onFileWritten: async (path) => {
        if (project) await refreshTree(project);
        await openFile(path);
      },
      confirmToolAction: confirmAiToolAction,
    }),
    [
      project,
      openFile,
      refreshTree,
      confirmAiToolAction,
      serverConsole.running,
      serverConsole.sendCommand,
      sqlDatabase.status.connected,
      sqlDatabase.executeQuery,
    ],
  );

  const saveActiveTab = useCallback(async () => {
    if (!activeTab) return;

    if (!activeTab.path) {
      setSaveState("Ouvre un projet et un fichier pour sauvegarder");
      return;
    }

    await saveProjectFile(project, activeTab.path, activeTab.content);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id ? { ...tab, originalContent: tab.content } : tab,
      ),
    );

    if (project && isRemoteProject(project)) {
      if (remoteServerSettings.liveReload && serverConsole.running) {
        const resourceName = getResourceNameFromPath(activeTab.path, project.rootPath);
        if (resourceName) {
          await serverConsole.restartResource(resourceName);
          setSaveState(`Uploadé · restart ${resourceName}`);
          return;
        }
      }
      setSaveState(`Uploadé · ${activeTab.fileName}`);
      return;
    }

    setSaveState(`Sauvegardé · ${activeTab.fileName}`);

    if (project && serverSettings.liveReload && serverConsole.running) {
      const resourceName = getResourceNameFromPath(activeTab.path, project.rootPath);
      if (resourceName) {
        await serverConsole.restartResource(resourceName);
        setSaveState(`Sauvegardé · restart ${resourceName}`);
      }
    }
  }, [
    activeTab,
    project,
    remoteServerSettings.liveReload,
    serverConsole,
    serverSettings.liveReload,
  ]);

  const updateTabContent = useCallback((tabId: string, value: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, content: value } : tab)),
    );
  }, []);

  const closeTabInGroupHandler = useCallback((groupId: string, tabId: string) => {
    const { layout, tabFullyClosed } = closeTabInGroup(workspace, groupId, tabId);
    setWorkspace(layout);

    if (!tabFullyClosed) return;

    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== tabId);
      if (next.length > 0) return next;

      const untitled = createUntitledTab(DEFAULT_LUA);
      setWorkspace(createInitialWorkspace(untitled.id));
      return [untitled];
    });
  }, [workspace]);

  const insertNative = useCallback((native: NativeFunction) => {
    if (!activeTab) return;
    const params = native.params.map((p) => p.name || "param").join(", ");
    const snippet = `${native.luaName}(${params})`;
    updateTabContent(
      activeTab.id,
      `${activeTab.content.trimEnd()}\n\n-- ${native.namespace} / ${native.name}\n${snippet}\n`,
    );
    setSelectedNative(native);
    setRightPanel("native");
  }, [activeTab, updateTabContent]);

  const applyAgentCode = useCallback(
    (code: string, mode: "append" | "replace" = "append") => {
      if (!activeTab) return;

      if (
        mode === "replace" &&
        editorSelection &&
        editorSelection.endOffset > editorSelection.startOffset
      ) {
        const next =
          activeTab.content.slice(0, editorSelection.startOffset) +
          code +
          activeTab.content.slice(editorSelection.endOffset);
        updateTabContent(activeTab.id, next);
        return;
      }

      updateTabContent(activeTab.id, `${activeTab.content.trimEnd()}\n\n${code}\n`);
    },
    [activeTab, editorSelection, updateTabContent],
  );

  const handleScaffold = useCallback(
    async (resourceName: string, files: Record<string, string>) => {
      if (!project) throw new Error("Aucun projet ouvert");
      const targetRoot =
        project.projectType === "server"
          ? `${project.rootPath}/resources`
          : project.rootPath;

      await writeScaffold(project, targetRoot, resourceName, files);
      await refreshTree(project);
      setSidebarTab("explorer");
    },
    [project, refreshTree],
  );

  const scaffoldFromAgent = useCallback(
    async (resourceName: string, files: Record<string, string>) => {
      await handleScaffold(resourceName, files);
      setSaveState(`Ressource créée · ${resourceName}`);
    },
    [handleScaffold],
  );

  const handleInstallTemplate = useCallback(
    async (template: MarketplaceTemplate) => {
      if (!project) throw new Error("Ouvre un projet d'abord");
      const targetRoot =
        project.projectType === "server"
          ? `${project.rootPath}/resources`
          : project.rootPath;

      await writeScaffold(project, targetRoot, template.id, template.files);
      await refreshTree(project);
      setSidebarTab("explorer");
      setSaveState(`Template installé · ${template.name}`);
    },
    [project, refreshTree],
  );

  const playInFiveM = useCallback(async () => {
    if (!project) {
      setPlayState("Ouvre un projet serveur d'abord");
      return;
    }

    setPlayState(null);
    setBottomPanel("terminal");

    if (!serverConsole.running) {
      await serverConsole.start();
    }

    try {
      await launchFiveMConnect(
        serverSettings.serverEndpoint,
        serverSettings.fivemClientPath || undefined,
      );
      setPlayState(`Connexion à ${serverSettings.serverEndpoint}`);
    } catch (err) {
      setPlayState(err instanceof Error ? err.message : "Impossible de lancer FiveM");
    }
  }, [project, serverConsole, serverSettings.serverEndpoint, serverSettings.fivemClientPath]);

  const handleDiagnosticSelect = useCallback((diagnostic: LintDiagnostic) => {
    setRevealLine(diagnostic.line);
    setBottomPanel("problems");
  }, []);

  const refreshProfiler = useCallback(() => {
    void serverConsole.sendCommand("profiler record 5");
    void serverConsole.sendCommand("resmon 1");
  }, [serverConsole]);

  const handlePluginCommand = useCallback(
    (command: string) => {
      setBottomPanel("terminal");
      void serverConsole.sendCommand(command);
    },
    [serverConsole],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveTab();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openProject();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        if (activeTab) {
          setWorkspace((prev) => duplicateActiveTabInSplit(prev, activeTab.id));
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, openProject, saveActiveTab]);

  useEffect(() => {
    if (!saveState && !playState) return;
    const timer = window.setTimeout(() => {
      setSaveState(null);
      setPlayState(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [saveState, playState]);

  useEffect(() => {
    if (platformSettings.gta6Preview || platformSettings.platform === "gta6") {
      setBottomPanel((prev) => (prev === null ? "migration" : prev));
    }
  }, [platformSettings.gta6Preview, platformSettings.platform]);

  return (
    <div className={styles.app}>
      <TitleBar
        fileName={activeTab?.fileName ?? "untitled.lua"}
        projectName={projectDisplayName}
        isRemoteProject={isRemoteProject(project)}
        onOpenProject={() => void openProject()}
        onOpenRemote={() => setShowRemoteConnect(true)}
        onOpenSql={() => setShowSqlConnect(true)}
        sqlConnected={sqlDatabase.status.connected}
        onToggleTerminal={() =>
          setBottomPanel((prev) => (prev === "terminal" ? null : "terminal"))
        }
        onToggleAgent={() =>
          setRightPanel((prev) => (prev === "agent" ? null : "agent"))
        }
        onOpenSettings={() => setShowSettings(true)}
        onPlay={() => void playInFiveM()}
        onNewResource={() => setShowScaffold(true)}
        canScaffold={!!project}
        canPlay={canPlayLocal}
        serverRunning={serverConsole.running}
        platformLabel={platformLabel}
      />

      <div className={styles.workspace}>
        <div className={styles.sidebarWrap} style={{ width: panelLayout.sidebarWidth }}>
          <Sidebar
            tab={sidebarTab}
            onTabChange={setSidebarTab}
            natives={nativesData.natives}
            namespaces={nativesData.namespaces}
            selectedNative={selectedNative}
            onSelectNative={(native) => {
              setSelectedNative(native);
              setRightPanel("native");
            }}
            onInsertNative={insertNative}
            project={project}
            framework={frameworkDetection}
            tree={tree}
            treeLoading={treeLoading}
            activePath={activeTab?.path ?? null}
            onOpenFile={(path) => void openFile(path)}
            onOpenProject={() => void openProject()}
            onOpenRemote={() => setShowRemoteConnect(true)}
            onRefresh={() => project && void refreshTree(project)}
            onExpandDirectory={expandDirectory}
            onInstallTemplate={handleInstallTemplate}
            catalogVersion={catalogVersion}
            catalogUrl={cloudSettings.catalogUrl}
            onCloudSync={syncCloud}
            plugins={pluginsState.plugins}
            pluginsLoading={pluginsState.loading}
            pluginsError={pluginsState.error}
            onRefreshPlugins={() => void pluginsState.refresh()}
            onTogglePlugin={pluginsState.togglePlugin}
          onPluginCommand={handlePluginCommand}
          sqlStatus={sqlDatabase.status}
          sqlDatabases={sqlDatabase.databases}
          sqlSchemaLoading={sqlDatabase.schemaLoading}
          sqlSelectContext={sqlSelectContext}
          onSqlConnect={() => setShowSqlConnect(true)}
          onSqlDisconnect={() => void sqlDatabase.disconnect()}
          onSqlRefreshSchema={() => void sqlDatabase.refreshSchema()}
          onSqlLoadTables={(database) => void sqlDatabase.loadTables(database)}
          onSqlPreviewTable={(database, table) => {
            const sql = formatTablePreviewQuery(database, table);
            setSqlQuery(sql);
            setSqlSelectContext({ database, table });
            setBottomPanel("database");
            void sqlDatabase.executeQuery(sql);
          }}
          onSqlDescribeTable={(database, table) => {
            setSqlQuery(`DESCRIBE \`${database.replace(/`/g, "``")}\`.\`${table.replace(/`/g, "``")}\`;`);
            setSqlSelectContext({ database, table });
            setBottomPanel("database");
            void sqlDatabase.describeTable(database, table);
          }}
          onSqlOpenTableTools={(database, table) => setSqlTableTools({ database, table })}
        />
        </div>

        <div
          className={styles.resizeHandleVertical}
          onMouseDown={startSidebarResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner l'explorateur"
        />

        <div className={styles.center}>
          <main className={styles.main}>
            <EditorWorkspace
              appTheme={appearanceSettings.theme}
              layout={workspace}
              tabs={tabs}
              tabMap={tabMap}
              diagnostics={diagnostics}
              revealLine={revealLine}
              nativeIndex={nativeIndex}
              onLayoutChange={setWorkspace}
              onTabChange={updateTabContent}
              onTabClose={closeTabInGroupHandler}
              onNativeSelect={(native) => {
                setSelectedNative(native);
                setRightPanel("native");
              }}
              onSelectionChange={setEditorSelection}
            />
          </main>

          {bottomPanel !== null && (
            <div
              className={styles.resizeHandleHorizontal}
              onMouseDown={startBottomResize}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Redimensionner le panneau inférieur"
            />
          )}

          <div
            className={styles.bottomPanel}
            style={{
              height: bottomPanel !== null ? panelLayout.bottomPanelHeight + 30 : 30,
            }}
          >
            <div className={styles.bottomTabs}>
              <button
                className={bottomPanel === "terminal" ? styles.bottomTabActive : styles.bottomTab}
                onClick={() => setBottomPanel(bottomPanel === "terminal" ? null : "terminal")}
              >
                Terminal
                {serverConsole.running && <span className={styles.liveDot}>●</span>}
              </button>
              <button
                className={bottomPanel === "database" ? styles.bottomTabActive : styles.bottomTab}
                onClick={() => setBottomPanel(bottomPanel === "database" ? null : "database")}
              >
                Database
                {sqlDatabase.status.connected && <span className={styles.liveDot}>●</span>}
              </button>
              <button
                className={bottomPanel === "resources" ? styles.bottomTabActive : styles.bottomTab}
                onClick={() => setBottomPanel(bottomPanel === "resources" ? null : "resources")}
              >
                Resources
                {resourceMonitor.summary.running > 0 && (
                  <span className={styles.badgeOk}>{resourceMonitor.summary.running}</span>
                )}
              </button>
              <button
                className={bottomPanel === "profiler" ? styles.bottomTabActive : styles.bottomTab}
                onClick={() => setBottomPanel(bottomPanel === "profiler" ? null : "profiler")}
              >
                Profiler
                {profiler.health !== "good" && serverConsole.running && (
                  <span className={styles.badgeWarn}>!</span>
                )}
              </button>
              {(platformSettings.platform === "gta6" || platformSettings.gta6Preview) && (
                <button
                  className={bottomPanel === "migration" ? styles.bottomTabActive : styles.bottomTab}
                  onClick={() => setBottomPanel(bottomPanel === "migration" ? null : "migration")}
                >
                  Migration VI
                </button>
              )}
              <button
                className={bottomPanel === "problems" ? styles.bottomTabActive : styles.bottomTab}
                onClick={() => setBottomPanel(bottomPanel === "problems" ? null : "problems")}
              >
                Problèmes
                {counts.error + counts.warning > 0 && (
                  <span className={styles.badge}>{counts.error + counts.warning}</span>
                )}
              </button>
            </div>

            {bottomPanel !== null && (
              <div className={styles.bottomContent}>
            {bottomPanel === "database" && (
              <DatabasePanel
                status={sqlDatabase.status}
                query={sqlQuery}
                executing={sqlDatabase.executing}
                error={sqlDatabase.error}
                result={sqlDatabase.lastResult}
                maxRows={sqlSettings.maxRows}
                history={sqlDatabase.history}
                favorites={sqlDatabase.favorites}
                selectContext={sqlSelectContext}
                onQueryChange={(value) => {
                  setSqlQuery(value);
                  setSqlSelectContext(parseSelectContext(value));
                }}
                onExecute={(sql) => void sqlDatabase.executeQuery(sql ?? sqlQuery)}
                onExplain={(sql) => {
                  const target = sql ?? sqlQuery;
                  void sqlDatabase.explainQuery(target);
                }}
                onImport={() => setShowSqlImport(true)}
                onConnect={() => setShowSqlConnect(true)}
                onToggleFavorite={(sql) => sqlDatabase.toggleFavorite(sql)}
              />
            )}
            {bottomPanel === "terminal" && (
              <TerminalPanel
                logs={serverConsole.logs}
                running={serverConsole.running}
                fxBinary={serverConsole.fxBinary}
                error={serverConsole.error}
                liveReload={serverConsole.liveReload}
                mode={serverConsole.mode}
                polling={"polling" in serverConsole ? serverConsole.polling : false}
                onStart={() => void serverConsole.start()}
                onStop={() => void serverConsole.stop()}
                onCommand={(cmd) => void serverConsole.sendCommand(cmd)}
                onClear={serverConsole.clearLogs}
                onRefreshLogs={
                  "refreshLogs" in serverConsole
                    ? () => void serverConsole.refreshLogs()
                    : undefined
                }
                onToggleLiveReload={() => {
                  if (isRemoteProject(project)) {
                    setRemoteServerSettings((prev) => {
                      const next = { ...prev, liveReload: !prev.liveReload };
                      saveRemoteServerSettings(next);
                      return next;
                    });
                    return;
                  }
                  setServerSettings((prev) => {
                    const next = { ...prev, liveReload: !prev.liveReload };
                    saveServerSettings(next);
                    return next;
                  });
                }}
              />
            )}
            {bottomPanel === "resources" && (
              <ResourceMonitorPanel
                metrics={resourceMonitor.metrics}
                summary={resourceMonitor.summary}
                serverRunning={serverConsole.running}
                onRestart={(name) => void serverConsole.sendCommand(`restart ${name}`)}
                onRefreshResmon={() => void serverConsole.sendCommand("resmon 1")}
              />
            )}
            {bottomPanel === "profiler" && (
              <ProfilerPanel
                snapshot={profiler.snapshot}
                history={profiler.history}
                health={profiler.health}
                topConsumers={profiler.topConsumers}
                onRefresh={refreshProfiler}
                serverRunning={serverConsole.running}
              />
            )}
            {bottomPanel === "migration" && (
              <MigrationPanel
                platform={platformSettings.platform}
                code={activeTab?.content ?? ""}
                onApplyMigration={(code) => {
                  if (activeTab) updateTabContent(activeTab.id, code);
                }}
              />
            )}
            {bottomPanel === "problems" && (
              <ProblemsPanel
                diagnostics={diagnostics}
                onSelect={handleDiagnosticSelect}
              />
            )}
              </div>
            )}
          </div>
        </div>

        {rightPanel !== null && (
          <div
            className={styles.resizeHandleVertical}
            onMouseDown={startDetailResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner le panneau latéral"
          />
        )}

        {rightPanel === "native" && selectedNative && (
          <div className={styles.detailWrap} style={{ width: panelLayout.detailWidth }}>
            <NativeDetail
              native={selectedNative}
              onClose={() => setRightPanel(null)}
              onInsert={() => insertNative(selectedNative)}
            />
          </div>
        )}

        {rightPanel === "agent" && (
          <div className={styles.detailWrap} style={{ width: panelLayout.detailWidth }}>
            <AgentPanel
              settings={aiSettings}
              project={project}
              framework={frameworkDetection}
              tree={tree}
              diagnostics={diagnostics}
              exportCompletions={exportCompletions}
              activeFileName={activeTab?.fileName ?? null}
              activeCode={activeTab?.content ?? ""}
              selection={editorSelection}
              onApplyCode={applyAgentCode}
              onScaffoldResource={scaffoldFromAgent}
              toolHandlers={aiToolHandlers}
              onOpenSettings={() => setShowSettings(true)}
            />
          </div>
        )}
      </div>

      <StatusBar
        nativeCount={nativesData.count}
        namespaceCount={nativesData.namespaces.length}
        fileName={activeTab?.fileName ?? "untitled.lua"}
        selectedNative={selectedNative}
        project={project}
        framework={frameworkDetection}
        serverRunning={serverConsole.running}
        platformLabel={platformLabel}
        resourceSummary={{
          running: resourceMonitor.summary.running,
          stopped: resourceMonitor.summary.stopped,
        }}
        diagnostics={counts}
        saveState={saveState ?? playState}
      />

      {showSettings && (
        <SettingsModal
          aiSettings={aiSettings}
          serverSettings={serverSettings}
          platformSettings={platformSettings}
          cloudSettings={cloudSettings}
          pluginSettings={pluginSettings}
          remoteServerSettings={remoteServerSettings}
          appearanceSettings={appearanceSettings}
          sqlSettings={sqlSettings}
          onSaveAi={(settings) => {
            void (async () => {
              try {
                if (settings.rememberApiKey && settings.apiKey.trim()) {
                  await saveAiKeychainKey(settings.provider, settings.apiKey);
                } else {
                  await deleteAiKeychainKey(settings.provider);
                }
              } catch {
                // keychain unavailable
              }
              setAiSettings(settings);
              saveAiSettings(settings);
            })();
          }}
          onSaveServer={(settings) => {
            setServerSettings(settings);
            saveServerSettings(settings);
          }}
          onSavePlatform={(settings) => {
            setPlatformSettings(settings);
            savePlatformSettings(settings);
          }}
          onSaveCloud={(settings) => {
            setCloudSettings(settings);
            saveCloudSettings(settings);
          }}
          onSavePlugins={(settings) => {
            setPluginSettings(settings);
            savePluginSettings(settings);
          }}
          onSaveRemoteServer={(settings) => {
            setRemoteServerSettings(settings);
            saveRemoteServerSettings(settings);
          }}
          onSaveAppearance={(settings) => {
            setAppearanceSettings(settings);
            saveAppearanceSettings(settings);
            applyAppearanceTheme(settings.theme);
          }}
          onSaveSql={(settings) => {
            setSqlSettings(settings);
            saveSqlSettings(settings);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showRemoteConnect && (
        <RemoteConnectModal
          onOpen={openRemoteProject}
          onClose={() => setShowRemoteConnect(false)}
        />
      )}

      {writeDiffRequest && (
        <AiWriteDiffModal
          request={writeDiffRequest}
          onApply={() => resolveWriteDiff(true)}
          onCancel={() => resolveWriteDiff(false)}
        />
      )}

      {showSqlConnect && (
        <SqlConnectModal
          project={project}
          status={sqlDatabase.status}
          connecting={sqlDatabase.connecting}
          onConnect={sqlDatabase.connect}
          onDisconnect={sqlDatabase.disconnect}
          onClose={() => setShowSqlConnect(false)}
        />
      )}

      {showSqlImport && (
        <SqlImportModal
          executing={sqlDatabase.executing}
          onClose={() => setShowSqlImport(false)}
          onImport={(sql, useTransaction) => sqlDatabase.runScript(sql, useTransaction)}
        />
      )}

      {sqlTableTools && (
        <SqlTableToolsModal
          database={sqlTableTools.database}
          table={sqlTableTools.table}
          executing={sqlDatabase.executing}
          onClose={() => setSqlTableTools(null)}
          onFetchDdl={sqlDatabase.fetchTableDdl}
          onFetchDump={sqlDatabase.fetchTableDump}
          onFetchIndexes={sqlDatabase.fetchTableIndexes}
          onAddColumn={sqlDatabase.addColumn}
          onCreateIndex={sqlDatabase.createIndex}
          onDropIndex={sqlDatabase.dropIndex}
        />
      )}

      {showScaffold && project && (
        <ScaffoldModal
          projectRoot={
            project.projectType === "server"
              ? `${project.rootPath}/resources`
              : project.rootPath
          }
          onScaffold={handleScaffold}
          onClose={() => setShowScaffold(false)}
        />
      )}
    </div>
  );
}