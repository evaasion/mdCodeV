import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectInfo } from "../lib/tauri-fs";
import { detectSqlFromProject } from "../lib/sql-project-detect";
import {
  deleteSqlKeychainPassword,
  getSqlKeychainPassword,
  saveSqlKeychainPassword,
  type SqlStatus,
} from "../lib/sql";
import {
  createSqlProfileId,
  deleteSqlProfile,
  loadSqlProfiles,
  upsertSqlProfile,
  type SqlConnectPayload,
  type SqlProfile,
} from "../lib/sql-settings";
import styles from "./SqlConnectModal.module.css";

interface SqlConnectModalProps {
  project: ProjectInfo | null;
  status: SqlStatus;
  connecting: boolean;
  onConnect: (payload: SqlConnectPayload) => Promise<SqlStatus>;
  onDisconnect: () => Promise<SqlStatus>;
  onClose: () => void;
}

export function SqlConnectModal({
  project,
  status,
  connecting,
  onConnect,
  onDisconnect,
  onClose,
}: SqlConnectModalProps) {
  const [profiles, setProfiles] = useState<SqlProfile[]>(() => loadSqlProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileName, setProfileName] = useState("Ma base FiveM");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(3306);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const profilesInitialized = useRef(false);

  const applyProfile = useCallback(async (profile: SqlProfile) => {
    setSelectedProfileId(profile.id);
    setProfileName(profile.name);
    setHost(profile.host);
    setPort(profile.port);
    setUsername(profile.username);
    setDatabase(profile.database ?? "");
    setError(null);
    try {
      const stored = await getSqlKeychainPassword(profile.id);
      if (stored) {
        setPassword(stored);
        setRememberPassword(true);
      } else {
        setPassword("");
        setRememberPassword(false);
      }
    } catch {
      setPassword("");
      setRememberPassword(false);
    }
  }, []);

  const resetToNewProfile = useCallback(() => {
    setSelectedProfileId("");
    setProfileName("Nouvelle base");
    setHost("127.0.0.1");
    setPort(3306);
    setUsername("root");
    setDatabase("");
    setPassword("");
    setError(null);
  }, []);

  useEffect(() => {
    if (profilesInitialized.current || profiles.length === 0) return;
    void applyProfile(profiles[0]);
    profilesInitialized.current = true;
  }, [profiles, applyProfile]);

  async function handleConnect() {
    setError(null);
    try {
      const profileId = selectedProfileId || createSqlProfileId();
      await onConnect({
        host: host.trim(),
        port,
        username: username.trim(),
        password: password || undefined,
        database: database.trim() || undefined,
      });

      if (rememberPassword && password) {
        await saveSqlKeychainPassword(profileId, password);
      } else if (selectedProfileId) {
        await deleteSqlKeychainPassword(selectedProfileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion échouée");
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await onDisconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Déconnexion échouée");
    }
  }

  async function saveProfile() {
    const profile: SqlProfile = {
      id: selectedProfileId || createSqlProfileId(),
      name: profileName.trim() || host.trim() || "MySQL",
      host: host.trim(),
      port,
      username: username.trim(),
      database: database.trim() || undefined,
    };
    const next = upsertSqlProfile(profile);
    setProfiles(next);
    setSelectedProfileId(profile.id);

    if (rememberPassword && password) {
      await saveSqlKeychainPassword(profile.id, password);
    }
  }

  async function importFromProject() {
    if (!project) {
      setError("Ouvre un projet FiveM pour importer la config MySQL");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const detected = await detectSqlFromProject(project);
      if (detected.length === 0) {
        setError("Aucune config MySQL trouvée (server.cfg, oxmysql...)");
        return;
      }
      const config = detected[0];
      setHost(config.host);
      setPort(config.port);
      setUsername(config.username);
      setDatabase(config.database ?? "");
      if (config.password) setPassword(config.password);
      setProfileName(`Import · ${config.label}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import projet échoué");
    } finally {
      setImporting(false);
    }
  }

  async function removeProfile() {
    if (!selectedProfileId) return;
    await deleteSqlKeychainPassword(selectedProfileId);
    const next = deleteSqlProfile(selectedProfileId);
    setProfiles(next);
    if (next.length > 0) {
      await applyProfile(next[0]);
    } else {
      resetToNewProfile();
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Connexion MySQL</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.profileRow}>
            <label>
              Profil
              <select
                value={selectedProfileId}
                onChange={(event) => {
                  const profile = profiles.find((item) => item.id === event.target.value);
                  if (profile) void applyProfile(profile);
                }}
              >
                <option value="">Nouveau profil</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.secondaryBtn} onClick={resetToNewProfile}>
              + Nouveau
            </button>
          </div>

          <label>
            Nom du profil
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </label>
          <label>
            Hôte
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="127.0.0.1" />
          </label>
          <label>
            Port
            <input
              type="number"
              value={port}
              onChange={(event) => setPort(Number(event.target.value) || 3306)}
            />
          </label>
          <label>
            Utilisateur
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={status.connected ? "Laisser vide pour garder la session" : ""}
            />
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(event) => setRememberPassword(event.target.checked)}
            />
            Mémoriser le mot de passe (Keychain OS)
          </label>
          <div className={styles.importRow}>
            <button
              className={styles.secondaryBtn}
              onClick={() => void importFromProject()}
              disabled={!project || importing}
            >
              {importing ? "Scan..." : "Importer depuis le projet"}
            </button>
            {!project && (
              <span className={styles.importHint}>Ouvre un projet pour scanner server.cfg / oxmysql</span>
            )}
          </div>

          <label>
            Base par défaut
            <input
              value={database}
              onChange={(event) => setDatabase(event.target.value)}
              placeholder="fivem (optionnel)"
            />
          </label>

          {status.connected && (
            <p className={styles.connected}>
              Connecté à {status.username}@{status.host}:{status.port}
              {status.database ? ` / ${status.database}` : ""}
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={saveProfile}>
            Sauver profil
          </button>
          {selectedProfileId && (
            <button className={styles.secondaryBtn} onClick={removeProfile}>
              Supprimer
            </button>
          )}
          {status.connected ? (
            <button className={styles.disconnectBtn} onClick={() => void handleDisconnect()}>
              Déconnecter
            </button>
          ) : (
            <button
              className={styles.connectBtn}
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              {connecting ? "Connexion..." : "Connecter"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}