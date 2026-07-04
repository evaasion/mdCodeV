import { useState } from "react";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
  type AppTheme,
} from "../lib/appearance";
import {
  DEFAULT_SQL_SETTINGS,
  type SqlSettings,
} from "../lib/sql-settings";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_CLOUD_SETTINGS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  DEFAULT_REMOTE_SERVER_SETTINGS,
  DEFAULT_SERVER_SETTINGS,
  providerPresets,
  type AiProvider,
  type AiSettings,
  type CloudSettings,
  type PlatformSettings,
  type PluginSettings,
  type RemoteServerSettings,
  type ServerSettings,
} from "../lib/settings";
import styles from "./SettingsModal.module.css";

type SettingsTab = "appearance" | "ai" | "server" | "vps" | "platform" | "cloud" | "plugins" | "sql";

interface SettingsModalProps {
  aiSettings: AiSettings;
  serverSettings: ServerSettings;
  platformSettings: PlatformSettings;
  cloudSettings: CloudSettings;
  pluginSettings: PluginSettings;
  remoteServerSettings: RemoteServerSettings;
  appearanceSettings: AppearanceSettings;
  sqlSettings: SqlSettings;
  onSaveAi: (settings: AiSettings) => void;
  onSaveServer: (settings: ServerSettings) => void;
  onSaveRemoteServer: (settings: RemoteServerSettings) => void;
  onSavePlatform: (settings: PlatformSettings) => void;
  onSaveCloud: (settings: CloudSettings) => void;
  onSavePlugins: (settings: PluginSettings) => void;
  onSaveAppearance: (settings: AppearanceSettings) => void;
  onSaveSql: (settings: SqlSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  aiSettings,
  serverSettings,
  platformSettings,
  cloudSettings,
  pluginSettings,
  remoteServerSettings,
  appearanceSettings,
  sqlSettings,
  onSaveAi,
  onSaveServer,
  onSaveRemoteServer,
  onSavePlatform,
  onSaveCloud,
  onSavePlugins,
  onSaveAppearance,
  onSaveSql,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [aiDraft, setAiDraft] = useState<AiSettings>({ ...aiSettings });
  const [serverDraft, setServerDraft] = useState<ServerSettings>({ ...serverSettings });
  const [remoteDraft, setRemoteDraft] = useState<RemoteServerSettings>({ ...remoteServerSettings });
  const [platformDraft, setPlatformDraft] = useState<PlatformSettings>({ ...platformSettings });
  const [cloudDraft, setCloudDraft] = useState<CloudSettings>({ ...cloudSettings });
  const [pluginDraft, setPluginDraft] = useState<PluginSettings>({ ...pluginSettings });
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceSettings>({
    ...appearanceSettings,
  });
  const [sqlDraft, setSqlDraft] = useState<SqlSettings>({ ...sqlSettings });

  function updateProvider(provider: AiProvider) {
    setAiDraft((prev) => ({ ...prev, provider, ...providerPresets(provider) }));
  }

  function handleSave() {
    onSaveAi(aiDraft);
    onSaveServer(serverDraft);
    onSaveRemoteServer(remoteDraft);
    onSavePlatform(platformDraft);
    onSaveCloud(cloudDraft);
    onSavePlugins(pluginDraft);
    onSaveAppearance(appearanceDraft);
    onSaveSql(sqlDraft);
    onClose();
  }

  function handleReset() {
    if (tab === "appearance") setAppearanceDraft({ ...DEFAULT_APPEARANCE_SETTINGS });
    else if (tab === "sql") setSqlDraft({ ...DEFAULT_SQL_SETTINGS });
    else if (tab === "ai") setAiDraft({ ...DEFAULT_AI_SETTINGS });
    else if (tab === "server") setServerDraft({ ...DEFAULT_SERVER_SETTINGS });
    else if (tab === "vps") setRemoteDraft({ ...DEFAULT_REMOTE_SERVER_SETTINGS });
    else if (tab === "platform") setPlatformDraft({ ...DEFAULT_PLATFORM_SETTINGS });
    else if (tab === "cloud") setCloudDraft({ ...DEFAULT_CLOUD_SETTINGS });
    else setPluginDraft({ ...DEFAULT_PLUGIN_SETTINGS });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Paramètres</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          <button
            className={tab === "appearance" ? styles.tabActive : styles.tab}
            onClick={() => setTab("appearance")}
          >
            Apparence
          </button>
          <button
            className={tab === "ai" ? styles.tabActive : styles.tab}
            onClick={() => setTab("ai")}
          >
            IA
          </button>
          <button
            className={tab === "server" ? styles.tabActive : styles.tab}
            onClick={() => setTab("server")}
          >
            FXServer
          </button>
          <button
            className={tab === "vps" ? styles.tabActive : styles.tab}
            onClick={() => setTab("vps")}
          >
            VPS
          </button>
          <button
            className={tab === "platform" ? styles.tabActive : styles.tab}
            onClick={() => setTab("platform")}
          >
            Plateforme
          </button>
          <button
            className={tab === "cloud" ? styles.tabActive : styles.tab}
            onClick={() => setTab("cloud")}
          >
            Cloud
          </button>
          <button
            className={tab === "plugins" ? styles.tabActive : styles.tab}
            onClick={() => setTab("plugins")}
          >
            Plugins
          </button>
          <button
            className={tab === "sql" ? styles.tabActive : styles.tab}
            onClick={() => setTab("sql")}
          >
            SQL
          </button>
        </div>

        <div className={styles.body}>
          {tab === "appearance" && (
            <>
              <p className={styles.hint}>
                Choisis un thème adapté à tes sessions de code nocturnes. Le mode noir OLED réduit
                la lumière émise par l&apos;écran.
              </p>
              <div className={styles.themeOptions}>
                {(
                  [
                    {
                      id: "dark" as AppTheme,
                      label: "Sombre",
                      description: "Fond gris foncé, confortable en journée",
                      swatch: "#0d0f12",
                    },
                    {
                      id: "black" as AppTheme,
                      label: "Noir OLED (nuit)",
                      description: "Fond noir pur, idéal pour coder la nuit",
                      swatch: "#000000",
                    },
                  ] as const
                ).map((option) => {
                  const selected = appearanceDraft.theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={selected ? styles.themeOptionActive : styles.themeOption}
                      onClick={() => setAppearanceDraft({ theme: option.id })}
                    >
                      <span
                        className={styles.themeSwatch}
                        style={{ background: option.swatch }}
                        aria-hidden
                      />
                      <span className={styles.themeCopy}>
                        <span className={styles.themeLabel}>{option.label}</span>
                        <span className={styles.themeDescription}>{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === "ai" && (
            <>
              <label>
                Provider
                <select
                  value={aiDraft.provider}
                  onChange={(e) => updateProvider(e.target.value as AiProvider)}
                >
                  <option value="openai-compatible">OpenAI-compatible (Grok, Ollama...)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </label>
              <label>
                Clé API
                <input
                  type="password"
                  value={aiDraft.apiKey}
                  onChange={(e) => setAiDraft({ ...aiDraft, apiKey: e.target.value })}
                />
              </label>
              <label>
                Base URL
                <input
                  value={aiDraft.baseUrl}
                  onChange={(e) => setAiDraft({ ...aiDraft, baseUrl: e.target.value })}
                />
              </label>
              <label>
                Modèle
                <input
                  value={aiDraft.model}
                  onChange={(e) => setAiDraft({ ...aiDraft, model: e.target.value })}
                />
              </label>
              <label>
                Framework cible (agent IA)
                <select
                  value={aiDraft.framework}
                  onChange={(e) =>
                    setAiDraft({
                      ...aiDraft,
                      framework: e.target.value as AiSettings["framework"],
                    })
                  }
                >
                  <option value="qbcore">QBCore</option>
                  <option value="qbox">Qbox</option>
                  <option value="esx">ESX</option>
                  <option value="standalone">Standalone</option>
                </select>
              </label>
            </>
          )}

          {tab === "server" && (
            <>
              <label>
                Chemin FXServer (optionnel)
                <input
                  value={serverDraft.fxServerPath}
                  onChange={(e) =>
                    setServerDraft({ ...serverDraft, fxServerPath: e.target.value })
                  }
                  placeholder="Auto-détection"
                />
              </label>
              <label>
                Chemin FiveM client (optionnel)
                <input
                  value={serverDraft.fivemClientPath}
                  onChange={(e) =>
                    setServerDraft({ ...serverDraft, fivemClientPath: e.target.value })
                  }
                  placeholder="/Applications/FiveM.app"
                />
              </label>
              <label>
                Endpoint connexion
                <input
                  value={serverDraft.serverEndpoint}
                  onChange={(e) =>
                    setServerDraft({ ...serverDraft, serverEndpoint: e.target.value })
                  }
                  placeholder="127.0.0.1:30120"
                />
              </label>
              <label>
                Fichier config
                <input
                  value={serverDraft.cfgFile}
                  onChange={(e) => setServerDraft({ ...serverDraft, cfgFile: e.target.value })}
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={serverDraft.liveReload}
                  onChange={(e) =>
                    setServerDraft({ ...serverDraft, liveReload: e.target.checked })
                  }
                />
                Live reload à la sauvegarde (⌘S)
              </label>
            </>
          )}

          {tab === "vps" && (
            <>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={remoteDraft.liveReload}
                  onChange={(e) =>
                    setRemoteDraft({ ...remoteDraft, liveReload: e.target.checked })
                  }
                />
                Live reload distant après upload (⌘S)
              </label>
              <label>
                Preset console FXServer
                <select
                  value={remoteDraft.consolePreset}
                  onChange={(e) =>
                    setRemoteDraft({
                      ...remoteDraft,
                      consolePreset: e.target.value as RemoteServerSettings["consolePreset"],
                    })
                  }
                >
                  <option value="screen">GNU Screen</option>
                  <option value="tmux">tmux</option>
                  <option value="raw">Commande brute SSH</option>
                  <option value="custom">Template personnalisé</option>
                </select>
              </label>
              {remoteDraft.consolePreset === "screen" && (
                <label>
                  Nom session screen
                  <input
                    value={remoteDraft.screenSessionName}
                    onChange={(e) =>
                      setRemoteDraft({ ...remoteDraft, screenSessionName: e.target.value })
                    }
                    placeholder="fivem"
                  />
                </label>
              )}
              {remoteDraft.consolePreset === "tmux" && (
                <label>
                  Nom session tmux
                  <input
                    value={remoteDraft.tmuxSessionName}
                    onChange={(e) =>
                      setRemoteDraft({ ...remoteDraft, tmuxSessionName: e.target.value })
                    }
                    placeholder="fivem"
                  />
                </label>
              )}
              {remoteDraft.consolePreset === "custom" && (
                <label>
                  Template commande SSH
                  <input
                    value={remoteDraft.consoleCommandTemplate}
                    onChange={(e) =>
                      setRemoteDraft({
                        ...remoteDraft,
                        consoleCommandTemplate: e.target.value,
                      })
                    }
                    placeholder={'screen -S fivem -X stuff "{command}\\n"'}
                  />
                </label>
              )}
              <label>
                Chemin log FXServer sur le VPS
                <input
                  value={remoteDraft.logFilePath}
                  onChange={(e) =>
                    setRemoteDraft({ ...remoteDraft, logFilePath: e.target.value })
                  }
                  placeholder="/home/user/fivem/server.log"
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={remoteDraft.pollLogs}
                  onChange={(e) =>
                    setRemoteDraft({ ...remoteDraft, pollLogs: e.target.checked })
                  }
                />
                Rafraîchir les logs distants automatiquement
              </label>
              <label>
                Intervalle polling logs (sec)
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={remoteDraft.logPollIntervalSec}
                  onChange={(e) =>
                    setRemoteDraft({
                      ...remoteDraft,
                      logPollIntervalSec: Number(e.target.value) || 4,
                    })
                  }
                />
              </label>
              <p className={styles.hint}>
                Utilise <code>{"{command}"}</code> dans le template custom. Exemples : screen, tmux,
                ou une commande txAdmin selon ton hébergeur.
              </p>
            </>
          )}

          {tab === "platform" && (
            <>
              <label>
                Plateforme active
                <select
                  value={platformDraft.platform}
                  onChange={(e) =>
                    setPlatformDraft({
                      ...platformDraft,
                      platform: e.target.value as PlatformSettings["platform"],
                    })
                  }
                >
                  <option value="fivem">FiveM / GTA V</option>
                  <option value="gta6">GTA VI (Preview)</option>
                </select>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={platformDraft.gta6Preview}
                  onChange={(e) =>
                    setPlatformDraft({ ...platformDraft, gta6Preview: e.target.checked })
                  }
                />
                Activer l'assistant migration GTA VI
              </label>
              <p className={styles.hint}>
                Le mode GTA VI prépare tes scripts pour la future plateforme Rockstar RP.
                Les natives GTA V restent disponibles en attendant la doc officielle GTA VI.
              </p>
            </>
          )}

          {tab === "cloud" && (
            <>
              <label>
                URL catalogue cloud
                <input
                  value={cloudDraft.catalogUrl}
                  onChange={(e) =>
                    setCloudDraft({ ...cloudDraft, catalogUrl: e.target.value })
                  }
                  placeholder="bundled ou https://..."
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={cloudDraft.autoSyncOnStart}
                  onChange={(e) =>
                    setCloudDraft({ ...cloudDraft, autoSyncOnStart: e.target.checked })
                  }
                />
                Synchroniser le catalogue au démarrage
              </label>
              <p className={styles.hint}>
                Utilise <code>bundled</code> pour le catalogue local Phase 4, ou une URL JSON
                distante compatible mdcodeV Marketplace.
              </p>
            </>
          )}

          {tab === "plugins" && (
            <>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={pluginDraft.loadGlobalPlugins}
                  onChange={(e) =>
                    setPluginDraft({ ...pluginDraft, loadGlobalPlugins: e.target.checked })
                  }
                />
                Charger les plugins globaux (~/.mdcodev/plugins)
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={pluginDraft.loadProjectPlugins}
                  onChange={(e) =>
                    setPluginDraft({ ...pluginDraft, loadProjectPlugins: e.target.checked })
                  }
                />
                Charger les plugins du projet (.mdcodev/plugins)
              </label>
              <p className={styles.hint}>
                Les plugins ajoutent des règles lint, completions Monaco et commandes FXServer.
              </p>
            </>
          )}

          {tab === "sql" && (
            <>
              <label>
                Limite de lignes par requête
                <input
                  type="number"
                  min={50}
                  max={2000}
                  value={sqlDraft.maxRows}
                  onChange={(e) =>
                    setSqlDraft({
                      ...sqlDraft,
                      maxRows: Number(e.target.value) || DEFAULT_SQL_SETTINGS.maxRows,
                    })
                  }
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={sqlDraft.confirmDestructive}
                  onChange={(e) =>
                    setSqlDraft({ ...sqlDraft, confirmDestructive: e.target.checked })
                  }
                />
                Confirmer les requêtes UPDATE / DELETE / DROP
              </label>
              <p className={styles.hint}>
                L&apos;historique et les favoris SQL sont stockés localement. Les mots de passe MySQL
                ne sont jamais sauvegardés dans les profils.
              </p>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>
            Réinitialiser
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}