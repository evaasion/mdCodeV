import { useState } from "react";
import type { FrameworkDetection } from "@mdcodev/fivem-project";
import { isRemoteProject } from "../lib/project-fs";
import type { FileNode, ProjectInfo } from "../lib/tauri-fs";
import styles from "./FileExplorer.module.css";

interface FileExplorerProps {
  project: ProjectInfo | null;
  framework: FrameworkDetection | null;
  tree: FileNode[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenProject: () => void;
  onOpenRemote: () => void;
  onRefresh: () => void;
  onExpandDirectory: (path: string) => Promise<void>;
  loading: boolean;
}

function TreeNode({
  node,
  depth,
  activePath,
  onOpenFile,
  onExpandDirectory,
}: {
  node: FileNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onExpandDirectory: (path: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggleDir() {
    if (!open && node.children === undefined) {
      setLoading(true);
      try {
        await onExpandDirectory(node.path);
      } finally {
        setLoading(false);
      }
    }
    setOpen((value) => !value);
  }

  if (node.isDir) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isEmpty = node.children !== undefined && node.children.length === 0;

    return (
      <div>
        <button
          className={styles.dir}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => void toggleDir()}
        >
          <span className={styles.chevron}>
            {loading ? "…" : open ? "▾" : "▸"}
          </span>
          <span className={styles.folderIcon}>📁</span>
          {node.name}
        </button>
        {open && hasChildren &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpenFile={onOpenFile}
              onExpandDirectory={onExpandDirectory}
            />
          ))}
        {open && isEmpty && (
          <p className={styles.emptyDir} style={{ paddingLeft: 24 + depth * 12 }}>
            Dossier vide
          </p>
        )}
      </div>
    );
  }

  const active = activePath === node.path;
  return (
    <button
      className={active ? styles.fileActive : styles.file}
      style={{ paddingLeft: 24 + depth * 12 }}
      onClick={() => onOpenFile(node.path)}
    >
      <span className={styles.fileIcon}>◆</span>
      {node.name}
    </button>
  );
}

export function FileExplorer({
  project,
  framework,
  tree,
  activePath,
  onOpenFile,
  onOpenProject,
  onOpenRemote,
  onRefresh,
  onExpandDirectory,
  loading,
}: FileExplorerProps) {
  return (
    <div className={styles.explorer}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={onOpenProject}>
          Local
        </button>
        <button className={styles.toolBtn} onClick={onOpenRemote}>
          SFTP
        </button>
        <button className={styles.toolBtn} onClick={onRefresh} disabled={!project || loading}>
          ↻
        </button>
      </div>

      {project ? (
        <>
          <div className={styles.projectMeta}>
            <p className={styles.projectName}>
              {isRemoteProject(project)
                ? `${project.remoteLabel ?? project.remoteHost} · ${project.rootPath.split("/").pop()}`
                : project.rootPath.split(/[/\\]/).pop()}
            </p>
            <p className={styles.projectType}>
              {isRemoteProject(project) && "SFTP · "}
              {project.projectType === "resource" && "Ressource FiveM"}
              {project.projectType === "server" && `Serveur · ${project.resources.length} resources`}
              {project.projectType === "unknown" && "Dossier"}
              {framework && (
                <>
                  {" · "}
                  {framework.framework.toUpperCase()}
                  {framework.usesOxLib ? " + ox_lib" : ""}
                  {framework.confidence !== "high" ? ` (${framework.confidence})` : ""}
                </>
              )}
            </p>
          </div>
          <div className={styles.tree}>
            {loading && <p className={styles.hint}>Chargement...</p>}
            {!loading &&
              tree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activePath}
                  onOpenFile={onOpenFile}
                  onExpandDirectory={onExpandDirectory}
                />
              ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun projet ouvert</p>
          <p className={styles.emptyText}>
            Ouvre un dossier serveur FiveM ou une ressource avec fxmanifest.lua
          </p>
          <button className={styles.openBtn} onClick={onOpenProject}>
            Ouvrir local
          </button>
          <button className={styles.openBtn} onClick={onOpenRemote}>
            Ouvrir SFTP
          </button>
        </div>
      )}
    </div>
  );
}