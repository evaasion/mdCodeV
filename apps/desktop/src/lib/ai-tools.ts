import { fetchDirectory, readProjectFile, saveProjectFile } from "./project-fs";
import type { ProjectInfo } from "./tauri-fs";

export interface AiToolHandlers {
  project: ProjectInfo | null;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listDirectory: (path: string) => Promise<string>;
  sqlQuery: (sql: string) => Promise<string>;
  restartResource: (resource: string) => Promise<string>;
  sendServerCommand: (command: string) => Promise<string>;
  onFileWritten?: (path: string) => Promise<void>;
  confirmToolAction?: (name: string, args: Record<string, unknown>) => Promise<boolean>;
}

const CONFIRM_TOOLS = new Set([
  "write_project_file",
  "restart_resource",
  "send_server_command",
]);

export function toolConfirmMessage(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "write_project_file":
      return `L'agent veut écrire le fichier:\n${String(args.path ?? "?")}\n\nAutoriser ?`;
    case "restart_resource":
      return `L'agent veut redémarrer la ressource:\n${String(args.resource ?? "?")}\n\nAutoriser ?`;
    case "send_server_command":
      return `L'agent veut exécuter sur la console serveur:\n${String(args.command ?? "?")}\n\nAutoriser ?`;
    default:
      return `L'agent veut exécuter: ${name}\n\nAutoriser ?`;
  }
}

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "read_project_file",
      description: "Lit un fichier du projet FiveM ouvert. Chemin absolu ou relatif au root du projet.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin du fichier" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_project_file",
      description: "Écrit ou remplace un fichier dans le projet ouvert.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin du fichier" },
          content: { type: "string", description: "Contenu complet du fichier" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_project_directory",
      description: "Liste les fichiers et dossiers d'un répertoire du projet.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Répertoire (optionnel, défaut = racine projet)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sql_query",
      description: "Exécute une requête SQL sur la connexion MySQL active (oxmysql). SELECT recommandé.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Requête SQL" },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restart_resource",
      description: "Redémarre une ressource FiveM via la console serveur (restart <name>).",
      parameters: {
        type: "object",
        properties: {
          resource: { type: "string", description: "Nom de la ressource" },
        },
        required: ["resource"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_server_command",
      description: "Envoie une commande à la console FXServer (status, refresh, ensure, etc.).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Commande console" },
        },
        required: ["command"],
      },
    },
  },
];

export const ANTHROPIC_TOOL_DEFINITIONS = AI_TOOL_DEFINITIONS.map((tool) => ({
  name: tool.function.name,
  description: tool.function.description,
  input_schema: tool.function.parameters,
}));

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function resolveProjectPath(project: ProjectInfo | null, rawPath: string): string | null {
  if (!project) return null;
  const root = normalizePath(project.rootPath).replace(/\/+$/, "");
  const input = normalizePath(rawPath.trim());

  if (!input) return root;

  const absolute = input.startsWith("/") || /^[A-Za-z]:\//.test(input);
  const candidate = absolute ? input : `${root}/${input.replace(/^\.?\//, "")}`;
  const normalized = normalizePath(candidate);

  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }

  return null;
}

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  handlers: AiToolHandlers,
): Promise<string> {
  const project = handlers.project;

  try {
    if (CONFIRM_TOOLS.has(name)) {
      const allowed = handlers.confirmToolAction
        ? await handlers.confirmToolAction(name, args)
        : true;
      if (!allowed) return "Action refusée par l'utilisateur.";
    }

    switch (name) {
      case "read_project_file": {
        const path = String(args.path ?? "");
        const resolved = resolveProjectPath(project, path);
        if (!resolved) return "Erreur: chemin hors projet ou projet non ouvert";
        const content = await handlers.readFile(resolved);
        const max = 12000;
        if (content.length > max) {
          return `${content.slice(0, max)}\n\n...[tronqué ${content.length - max} caractères]`;
        }
        return content;
      }

      case "write_project_file": {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        const resolved = resolveProjectPath(project, path);
        if (!resolved) return "Erreur: chemin hors projet ou projet non ouvert";
        await handlers.writeFile(resolved, content);
        await handlers.onFileWritten?.(resolved);
        return `Fichier écrit: ${resolved}`;
      }

      case "list_project_directory": {
        const raw = String(args.path ?? project?.rootPath ?? "");
        const resolved = resolveProjectPath(project, raw || project?.rootPath || "");
        if (!resolved || !project) return "Erreur: projet non ouvert";
        return handlers.listDirectory(resolved);
      }

      case "sql_query": {
        const sql = String(args.sql ?? "").trim();
        if (!sql) return "Erreur: requête SQL vide";
        return handlers.sqlQuery(sql);
      }

      case "restart_resource": {
        const resource = String(args.resource ?? "").trim();
        if (!resource) return "Erreur: nom de ressource requis";
        return handlers.restartResource(resource);
      }

      case "send_server_command": {
        const command = String(args.command ?? "").trim();
        if (!command) return "Erreur: commande vide";
        return handlers.sendServerCommand(command);
      }

      default:
        return `Erreur: outil inconnu ${name}`;
    }
  } catch (error) {
    return `Erreur: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function defaultListDirectory(
  project: ProjectInfo | null,
  path: string,
): Promise<string> {
  const nodes = await fetchDirectory(project, path);
  if (nodes.length === 0) return "(vide)";
  return nodes
    .map((node) => `${node.isDir ? "[DIR]" : "[FILE]"} ${node.name}`)
    .join("\n");
}

export function createDefaultReadFile(project: ProjectInfo | null) {
  return (path: string) => readProjectFile(project, path);
}

export function createDefaultWriteFile(project: ProjectInfo | null) {
  return (path: string, content: string) => saveProjectFile(project, path, content);
}