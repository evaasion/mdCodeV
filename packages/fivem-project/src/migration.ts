export interface MigrationNote {
  line: number;
  severity: "info" | "warning";
  message: string;
  suggestion?: string;
}

const REPLACEMENTS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
}> = [
  {
    pattern: /GetPlayerPed\s*\(\s*-1\s*\)/g,
    message: "GetPlayerPed(-1) déprécié sur FiveM",
    suggestion: "Remplacer par PlayerPedId()",
  },
  {
    pattern: /Citizen\.InvokeNative/g,
    message: "Citizen.InvokeNative — vérifier compatibilité plateforme GTA VI",
    suggestion: "Préférer les natives typées quand disponibles",
  },
  {
    pattern: /exports\[['"]qb-core['"]\]/g,
    message: "Pattern QBCore — à valider sur la future plateforme Rockstar RP",
    suggestion: "Abstraire via un bridge framework",
  },
  {
    pattern: /fx_version\s+['"]/g,
    message: "fxmanifest FiveM — format spécifique Cfx.re",
    suggestion: "Prévoir un manifest adapté GTA VI au lancement officiel",
  },
];

export function analyzeMigration(code: string): MigrationNote[] {
  const notes: MigrationNote[] = [];
  const lines = code.split("\n");

  lines.forEach((line, index) => {
    for (const rule of REPLACEMENTS) {
      if (rule.pattern.test(line)) {
        notes.push({
          line: index + 1,
          severity: "warning",
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
      rule.pattern.lastIndex = 0;
    }
  });

  return notes;
}

export function applyMigrationHints(code: string): string {
  return code
    .replace(/GetPlayerPed\s*\(\s*-1\s*\)/g, "PlayerPedId()")
    .replace(/Citizen\.Wait/g, "Wait");
}