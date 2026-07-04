import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectInfo } from "../lib/tauri-fs";
import {
  connectSftp,
  detectRemoteProject,
  disconnectSftp,
  listRemoteDirectory,
  type SftpStatus,
} from "../lib/remote";
import {
  createProfileId,
  deleteRemoteProfile,
  loadRemoteProfiles,
  upsertRemoteProfile,
  type RemoteAuthType,
  type RemoteProfile,
} from "../lib/remote-settings";
import styles from "./RemoteConnectModal.module.css";

interface RemoteConnectModalProps {
  onOpen: (project: ProjectInfo) => Promise<void>;
  onClose: () => void;
}

export function RemoteConnectModal({ onOpen, onClose }: RemoteConnectModalProps) {
  const [profiles, setProfiles] = useState<RemoteProfile[]>(() => loadRemoteProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profileName, setProfileName] = useState("Mon VPS");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<RemoteAuthType>("password");
  const [password, setPassword] = useState("");
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<SftpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remotePath, setRemotePath] = useState("/");
  const [entries, setEntries] = useState<{ name: string; path: string; isDir: boolean }[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const profilesInitialized = useRef(false);

  const applyProfile = useCallback((profile: RemoteProfile) => {
    setSelectedProfileId(profile.id);
    setProfileName(profile.name);
    setHost(profile.host);
    setPort(profile.port);
    setUsername(profile.username);
    setAuthType(profile.authType);
    setPrivateKeyPath(profile.privateKeyPath ?? "");
    setPassword("");
    setPassphrase("");
    setRemotePath(profile.defaultPath ?? "/");
    setSelectedPath(profile.defaultPath ?? null);
    setStatus(null);
    setError(null);
    setEntries([]);
  }, []);

  const resetToNewProfile = useCallback(() => {
    setSelectedProfileId("");
    setProfileName("Nouveau VPS");
    setHost("");
    setPort(22);
    setUsername("root");
    setAuthType("password");
    setPassword("");
    setPrivateKeyPath("");
    setPassphrase("");
    setRemotePath("/");
    setSelectedPath(null);
    setStatus(null);
    setError(null);
    setEntries([]);
  }, []);

  useEffect(() => {
    if (profilesInitialized.current || profiles.length === 0) return;
    applyProfile(profiles[0]);
    profilesInitialized.current = true;
  }, [profiles, applyProfile]);

  const refreshDirectory = useCallback(async (path: string) => {
    const nodes = await listRemoteDirectory(path);
    setEntries(
      nodes
        .filter((node) => node.isDir)
        .map((node) => ({ name: node.name, path: node.path, isDir: node.isDir })),
    );
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connectSftp({
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        password: authType === "password" ? password : undefined,
        privateKeyPath: authType === "privateKey" ? privateKeyPath : undefined,
        passphrase: authType === "privateKey" ? passphrase : undefined,
      });
      setStatus(result);
      await refreshDirectory(remotePath);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Connexion SFTP échouée");
    } finally {
      setConnecting(false);
    }
  }, [
    authType,
    host,
    password,
    passphrase,
    port,
    privateKeyPath,
    refreshDirectory,
    remotePath,
    username,
  ]);

  async function browseTo(path: string) {
    setRemotePath(path);
    setSelectedPath(path);
    await refreshDirectory(path);
  }

  async function pickPrivateKey() {
    const selected = await open({
      multiple: false,
      title: "Choisir une clé privée SSH",
    });
    if (!selected || Array.isArray(selected)) return;
    setPrivateKeyPath(selected);
  }

  function saveProfile() {
    const profile: RemoteProfile = {
      id: selectedProfileId || createProfileId(),
      name: profileName.trim() || host.trim() || "VPS",
      host: host.trim(),
      port,
      username: username.trim(),
      authType,
      privateKeyPath: authType === "privateKey" ? privateKeyPath : undefined,
      defaultPath: selectedPath ?? remotePath,
    };
    const next = upsertRemoteProfile(profile);
    setProfiles(next);
    setSelectedProfileId(profile.id);
  }

  function removeProfile() {
    if (!selectedProfileId) return;
    const next = deleteRemoteProfile(selectedProfileId);
    setProfiles(next);
    setSelectedProfileId(next[0]?.id ?? "");
    if (next[0]) applyProfile(next[0]);
  }

  async function handleOpenProject() {
    if (!status?.connected || !selectedPath) return;
    setOpening(true);
    setError(null);
    try {
      const project = await detectRemoteProject(
        selectedPath,
        status.host ?? host,
        profileName.trim() || status.host,
      );
      saveProfile();
      await onOpen(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ouverture projet distant échouée");
    } finally {
      setOpening(false);
    }
  }

  async function handleClose() {
    await disconnectSftp().catch(() => undefined);
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={() => void handleClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Ouvrir un projet distant (SFTP)</h2>
          <button onClick={() => void handleClose()}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.formPane}>
            <div className={styles.profileRow}>
              <select
                value={selectedProfileId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    resetToNewProfile();
                    return;
                  }
                  const profile = profiles.find((item) => item.id === value);
                  if (profile) applyProfile(profile);
                }}
              >
                <option value="">Nouveau profil</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button className={styles.smallBtn} onClick={resetToNewProfile}>
                + Nouveau
              </button>
              <button className={styles.smallBtn} onClick={saveProfile}>
                Sauver
              </button>
              <button
                className={styles.smallBtn}
                onClick={removeProfile}
                disabled={!selectedProfileId}
              >
                Suppr
              </button>
            </div>

            <label>
              Nom du profil
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </label>

            <div className={styles.row}>
              <label>
                Hôte VPS
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="123.45.67.89"
                />
              </label>
              <label>
                Port
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 22)}
                />
              </label>
            </div>

            <label>
              Utilisateur SSH
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>

            <div className={styles.authToggle}>
              <button
                className={authType === "password" ? styles.authBtnActive : styles.authBtn}
                onClick={() => setAuthType("password")}
              >
                Mot de passe
              </button>
              <button
                className={authType === "privateKey" ? styles.authBtnActive : styles.authBtn}
                onClick={() => setAuthType("privateKey")}
              >
                Clé privée
              </button>
            </div>

            {authType === "password" ? (
              <label>
                Mot de passe SSH
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label>
                  Chemin clé privée (locale)
                  <div className={styles.profileRow}>
                    <input
                      value={privateKeyPath}
                      onChange={(e) => setPrivateKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                    />
                    <button className={styles.smallBtn} onClick={() => void pickPrivateKey()}>
                      Parcourir
                    </button>
                  </div>
                </label>
                <label>
                  Passphrase (optionnel)
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </label>
              </>
            )}

            <button
              className={styles.connectBtn}
              onClick={() => void handleConnect()}
              disabled={connecting || !host.trim() || !username.trim()}
            >
              {connecting ? "Connexion..." : "Se connecter"}
            </button>

            {status?.connected && (
              <p className={styles.statusOk}>
                Connecté · {status.username}@{status.host}:{status.port}
              </p>
            )}
            {error && <p className={styles.statusErr}>{error}</p>}
              <p className={styles.hint}>
                Phase 6 : édition SFTP + console SSH. Configure VPS dans Settings après connexion.
              </p>
          </div>

          <div className={styles.browserPane}>
            <div className={styles.browserHead}>
              <h3>Dossier projet</h3>
            </div>
            <div className={styles.pathBar}>
              <input
                value={remotePath}
                onChange={(e) => setRemotePath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void browseTo(remotePath);
                }}
              />
              <button
                className={styles.smallBtn}
                onClick={() => void browseTo(remotePath)}
                disabled={!status?.connected}
              >
                Aller
              </button>
            </div>
            <button
              className={styles.smallBtn}
              onClick={() => {
                const parent = remotePath.replace(/\/[^/]+\/?$/, "") || "/";
                void browseTo(parent.endsWith("/") ? parent : parent || "/");
              }}
              disabled={!status?.connected || remotePath === "/"}
            >
              ↑ Parent
            </button>
            <div className={styles.dirList}>
              {!status?.connected && (
                <p className={styles.hint}>Connecte-toi pour parcourir le VPS.</p>
              )}
              {status?.connected &&
                entries.map((entry) => (
                  <button
                    key={entry.path}
                    className={
                      selectedPath === entry.path ? styles.dirItemActive : styles.dirItem
                    }
                    onClick={() => setSelectedPath(entry.path)}
                    onDoubleClick={() => void browseTo(entry.path)}
                  >
                    <span>📁</span>
                    {entry.name}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            {selectedPath
              ? `Sélection : ${selectedPath}`
              : "Choisis le dossier serveur (avec server.cfg) ou une ressource"}
          </span>
          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={() => void handleClose()}>
              Annuler
            </button>
            <button
              className={styles.openBtn}
              onClick={() => void handleOpenProject()}
              disabled={!status?.connected || !selectedPath || opening}
            >
              {opening ? "Ouverture..." : "Ouvrir ce dossier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}