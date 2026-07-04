import type { LintDiagnostic } from "@mdcodev/linter-core";

export interface QuickPromptContext {
  activeFileName: string | null;
  selectionText: string | null;
  diagnostics: LintDiagnostic[];
}

export interface QuickPrompt {
  id: string;
  label: string;
  build: (ctx: QuickPromptContext) => string | null;
}

export const AI_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "fix-linter",
    label: "Fix linter",
    build: (ctx) => {
      if (!ctx.activeFileName) return null;
      const issues =
        ctx.diagnostics.length > 0
          ? `\nErreurs à corriger:\n${ctx.diagnostics
              .slice(0, 15)
              .map((d) => `- L${d.line}: ${d.message}`)
              .join("\n")}`
          : "";
      return `Corrige les erreurs linter du fichier actif (${ctx.activeFileName}). Lis le fichier avec read_project_file si besoin, puis écris la version corrigée.${issues}`;
    },
  },
  {
    id: "explain",
    label: "Explique",
    build: (ctx) => {
      if (ctx.selectionText?.trim()) {
        return "Explique clairement ce code Lua sélectionné: rôle, flux, et pièges FiveM éventuels. Pas besoin de le réécrire sauf si bug évident.";
      }
      if (ctx.activeFileName) {
        return `Explique le fichier actif (${ctx.activeFileName}): structure, responsabilités, et points d'attention FiveM.`;
      }
      return null;
    },
  },
  {
    id: "review",
    label: "Review",
    build: (ctx) => {
      if (!ctx.activeFileName) return null;
      return `Fais une code review du fichier ${ctx.activeFileName}: bugs, perf, sécurité, conventions ${"FiveM"}. Propose des corrections concrètes si nécessaire.`;
    },
  },
  {
    id: "optimize-sql",
    label: "SQL",
    build: () =>
      "Si MySQL est connecté, analyse les tables pertinentes pour le projet et propose des requêtes SELECT utiles pour debug (joueurs, véhicules, jobs).",
  },
];