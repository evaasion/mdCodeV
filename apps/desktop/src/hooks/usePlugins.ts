import { useCallback, useEffect, useState } from "react";
import type { LoadedPlugin } from "@mdcodev/plugin-core";
import { loadPlugins } from "../lib/plugins";
import type { PluginSettings } from "../lib/settings";
import type { ProjectInfo } from "../lib/tauri-fs";

export function usePlugins(
  project: ProjectInfo | null,
  settings: PluginSettings,
) {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!settings.loadGlobalPlugins && !settings.loadProjectPlugins) {
      setPlugins([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPlugins(project, {
        loadGlobal: settings.loadGlobalPlugins,
        loadProject: settings.loadProjectPlugins,
      });
      setPlugins(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement plugins");
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, [project, settings.loadGlobalPlugins, settings.loadProjectPlugins]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePlugin = useCallback((pluginId: string) => {
    setPlugins((prev) =>
      prev.map((plugin) =>
        plugin.id === pluginId ? { ...plugin, enabled: !plugin.enabled } : plugin,
      ),
    );
  }, []);

  return { plugins, loading, error, refresh, togglePlugin };
}