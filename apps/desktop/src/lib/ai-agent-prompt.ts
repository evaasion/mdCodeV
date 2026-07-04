import type { FrameworkDetection } from "@mdcodev/fivem-project";
import type { AiSettings } from "./settings";
import { resolveAiFramework } from "./ai-context";

const FIVEM_SYSTEM_PROMPT = `Tu es l'agent IA de mdcodeV, un IDE spécialisé FiveM / GTA RP.
Règles strictes:
- Génère du Lua FiveM valide uniquement
- N'invente JAMAIS d'exports absents du contexte projet
- Utilise les vraies APIs du framework détecté
- Préfère PlayerPedId() à GetPlayerPed(-1)
- Réponds en français, code en anglais
- Quand tu proposes du code, utilise des blocs \`\`\`lua
- Pour une ressource multi-fichiers: \`\`\`lua path=ressource/fichier.lua

Outils disponibles (utilise-les pour agir sur le projet):
- read_project_file: lire un fichier avant de le modifier
- write_project_file: écrire un fichier (après l'avoir lu si existant)
- list_project_directory: explorer l'arborescence
- sql_query: interroger MySQL (si connecté)
- restart_resource: redémarrer une ressource FXServer
- send_server_command: commande console serveur

Workflow recommandé: lire → analyser → écrire → restart_resource si besoin.
Ne répète pas tout le contexte projet dans ta réponse.`;

export function buildSystemPrompt(
  settings: AiSettings,
  frameworkDetection: FrameworkDetection | null,
): string {
  const framework = resolveAiFramework(settings, frameworkDetection);
  const frameworkHints: Record<AiSettings["framework"], string> = {
    qbcore: "Framework: QBCore. Utilise exports['qb-core']:GetCoreObject().",
    qbox: "Framework: Qbox. Utilise exports.qbx_core:GetCoreObject().",
    esx: "Framework: ESX. Utilise exports.es_extended:getSharedObject().",
    standalone: "Framework: standalone. Pas de dépendance framework.",
  };

  const autoHint =
    settings.useAutoFramework && frameworkDetection
      ? `Détection projet: ${frameworkDetection.framework} (${frameworkDetection.confidence}).`
      : "";

  return `${FIVEM_SYSTEM_PROMPT}\n${frameworkHints[framework]}\n${autoHint}`.trim();
}