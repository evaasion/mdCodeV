import { HALLUCINATED_EXPORTS, KNOWN_EXPORTS } from "./known-exports.js";

export type LintSeverity = "error" | "warning" | "info";

export interface LintDiagnostic {
  line: number;
  column: number;
  endColumn?: number;
  message: string;
  severity: LintSeverity;
  rule: string;
}

export interface LintOptions {
  knownNatives: Set<string>;
  framework?: "qbcore" | "qbox" | "esx" | "standalone";
  usesOxLib?: boolean;
}

const EXPORT_CALL_RE =
  /exports\[['"]([^'"]+)['"]\]\s*:\s*([A-Za-z_][\w.]*)\s*\(|exports\.([A-Za-z_][\w]*)\s*\(/g;

const NATIVE_CALL_RE = /\b([A-Z][A-Za-z0-9_]*)\s*\(/g;

const EVENT_RE = /(?:RegisterNetEvent|AddEventHandler|TriggerEvent|TriggerServerEvent|TriggerClientEvent)\s*\(\s*['"]([^'"]+)['"]/g;

function lineColumnAt(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function checkUnbalanced(text: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: { char: string; index: number }[] = [];

  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = ch;
      continue;
    }

    if (ch === "-" && text[i + 1] === "-") {
      const rest = text.slice(i);
      if (rest.startsWith("--[[")) {
        const end = rest.indexOf("]]");
        if (end !== -1) {
          i += end + 1;
          continue;
        }
      }
      const nl = rest.indexOf("\n");
      i += nl === -1 ? rest.length - 1 : nl;
      continue;
    }

    if (ch in pairs) {
      stack.push({ char: ch, index: i });
      continue;
    }

    if (Object.values(pairs).includes(ch)) {
      const last = stack.pop();
      if (!last || pairs[last.char] !== ch) {
        const pos = lineColumnAt(text, i);
        diagnostics.push({
          ...pos,
          message: `Délimiteur '${ch}' inattendu`,
          severity: "error",
          rule: "syntax/unbalanced",
        });
      }
    }
  }

  for (const open of stack) {
    const pos = lineColumnAt(text, open.index);
    diagnostics.push({
      ...pos,
      message: `Délimiteur '${open.char}' non fermé`,
      severity: "error",
      rule: "syntax/unbalanced",
    });
  }

  return diagnostics;
}

function checkLibCalls(text: string, usesOxLib?: boolean): LintDiagnostic[] {
  if (!usesOxLib) return [];
  const diagnostics: LintDiagnostic[] = [];

  for (const match of text.matchAll(/\blib\.([A-Za-z_][\w.]*)\s*\(/g)) {
    const method = match[1];
    if (!method) continue;
    const known = KNOWN_EXPORTS.ox_lib;
    if (known.has(method)) continue;

    const pos = lineColumnAt(text, match.index ?? 0);
    diagnostics.push({
      ...pos,
      message: `lib.${method}() non reconnu — vérifie la doc ox_lib`,
      severity: "warning",
      rule: "fivem/unknown-ox-lib",
    });
  }

  return diagnostics;
}

function checkExports(text: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const match of text.matchAll(EXPORT_CALL_RE)) {
    const resource = match[1] ?? match[3];
    const method = match[2] ?? match[3];
    if (!resource || !method) continue;

    const hallucinated = HALLUCINATED_EXPORTS[resource];
    if (hallucinated?.includes(method)) {
      const pos = lineColumnAt(text, match.index ?? 0);
      diagnostics.push({
        ...pos,
        endColumn: pos.column + match[0].length,
        message: `Export halluciné: exports['${resource}']:${method}() n'existe probablement pas`,
        severity: "error",
        rule: "fivem/hallucinated-export",
      });
    }
  }

  return diagnostics;
}

function checkNatives(text: string, knownNatives: Set<string>): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const luaKeywords = new Set([
    "If", "Then", "Else", "End", "For", "While", "Do", "Repeat", "Until",
    "Function", "Local", "Return", "Not", "And", "Or", "In", "Break",
    "True", "False", "Nil", "Print", "Type", "Pairs", "Ipairs", "Next",
    "Table", "String", "Math", "Tonumber", "Tostring", "Pcall", "Xpcall",
    "Setmetatable", "Getmetatable", "Rawget", "Rawset", "Select", "Unpack",
    "Assert", "Error", "Require", "Load", "Loadfile", "Dofile",
  ]);

  for (const match of text.matchAll(NATIVE_CALL_RE)) {
    const name = match[1];
    if (!name || luaKeywords.has(name)) continue;
    if (!/^[A-Z]/.test(name)) continue;
    if (knownNatives.has(name)) continue;

    const pos = lineColumnAt(text, match.index ?? 0);
    diagnostics.push({
      ...pos,
      endColumn: pos.column + name.length,
      message: `Native inconnue: ${name}() — vérifie la doc FiveM`,
      severity: "warning",
      rule: "fivem/unknown-native",
    });
  }

  return diagnostics;
}

function checkEvents(text: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const seen = new Map<string, number>();

  for (const match of text.matchAll(EVENT_RE)) {
    const eventName = match[1];
    if (!eventName) continue;

    if (eventName.includes("::") || eventName.includes(" ")) {
      const pos = lineColumnAt(text, match.index ?? 0);
      diagnostics.push({
        ...pos,
        message: `Nom d'event suspect: '${eventName}'`,
        severity: "warning",
        rule: "fivem/event-name",
      });
    }

    const count = (seen.get(eventName) ?? 0) + 1;
    seen.set(eventName, count);
  }

  return diagnostics;
}

function checkCitizenPatterns(text: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  if (/Citizen\.Wait\s*\(\s*0\s*\)/.test(text)) {
    diagnostics.push({
      line: 1,
      column: 1,
      message: "Citizen.Wait(0) dans une boucle peut causer des lags — préfère Wait(100+) ou un tick handler",
      severity: "info",
      rule: "fivem/performance",
    });
  }

  if (/GetPlayerPed\s*\(\s*-1\s*\)/.test(text)) {
    const match = text.match(/GetPlayerPed\s*\(\s*-1\s*\)/);
    if (match?.index !== undefined) {
      const pos = lineColumnAt(text, match.index);
      diagnostics.push({
        ...pos,
        message: "GetPlayerPed(-1) est déprécié — utilise PlayerPedId()",
        severity: "warning",
        rule: "fivem/deprecated",
      });
    }
  }

  return diagnostics;
}

export function lintFiveMLua(code: string, options: LintOptions): LintDiagnostic[] {
  const results: LintDiagnostic[] = [
    ...checkUnbalanced(code),
    ...checkExports(code),
    ...checkLibCalls(code, options.usesOxLib),
    ...checkNatives(code, options.knownNatives),
    ...checkEvents(code),
    ...checkCitizenPatterns(code),
  ];

  const seen = new Set<string>();
  return results.filter((d) => {
    const key = `${d.line}:${d.column}:${d.rule}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}