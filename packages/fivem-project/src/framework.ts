import type { ExportCompletion, FiveMFramework, FrameworkDetection, FxManifest } from "./types.js";

export type { ExportCompletion, FiveMFramework, FrameworkDetection };

const FRAMEWORK_RESOURCE_HINTS: Record<FiveMFramework, string[]> = {
  qbcore: ["qb-core", "qb-inventory", "qb-target", "qb-menu"],
  qbox: ["qbx_core", "qbx_vehiclekeys", "ox_inventory"],
  esx: ["es_extended", "esx_menu_default", "esx_notify"],
  standalone: [],
};

export function detectFramework(input: {
  serverCfg?: string;
  manifest?: FxManifest;
  resources?: string[];
  codeSample?: string;
}): FrameworkDetection {
  const signals: string[] = [];
  const scores: Record<FiveMFramework, number> = {
    qbcore: 0,
    qbox: 0,
    esx: 0,
    standalone: 0,
  };

  const bump = (framework: FiveMFramework, weight: number, signal: string) => {
    scores[framework] += weight;
    signals.push(signal);
  };

  const resources = input.resources ?? [];
  const serverCfg = input.serverCfg ?? "";
  const codeSample = input.codeSample ?? "";
  const haystack = [serverCfg, codeSample, JSON.stringify(input.manifest ?? {})]
    .join("\n")
    .toLowerCase();

  for (const resource of resources) {
    const lower = resource.toLowerCase();
    for (const [framework, hints] of Object.entries(FRAMEWORK_RESOURCE_HINTS)) {
      if (hints.some((hint) => lower.includes(hint))) {
        bump(framework as FiveMFramework, 3, `resource:${resource}`);
      }
    }
  }

  if (/ensure\s+qb-core|start\s+qb-core/.test(serverCfg)) bump("qbcore", 4, "server.cfg:qb-core");
  if (/ensure\s+qbx_core|start\s+qbx_core/.test(serverCfg)) bump("qbox", 4, "server.cfg:qbx_core");
  if (/ensure\s+es_extended|start\s+es_extended/.test(serverCfg)) bump("esx", 4, "server.cfg:es_extended");

  for (const dep of input.manifest?.dependencies ?? []) {
    const lower = dep.toLowerCase();
    if (lower.includes("qb-core")) bump("qbcore", 3, `manifest.dep:${dep}`);
    if (lower.includes("qbx_core")) bump("qbox", 3, `manifest.dep:${dep}`);
    if (lower.includes("es_extended")) bump("esx", 3, `manifest.dep:${dep}`);
  }

  if (haystack.includes("qb-core") || haystack.includes("qbcore")) bump("qbcore", 2, "code:qb-core");
  if (haystack.includes("qbx_core") || haystack.includes("qbox")) bump("qbox", 2, "code:qbx_core");
  if (haystack.includes("es_extended") || haystack.includes("esx.getplayerdata")) bump("esx", 2, "code:esx");

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [winner, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  const framework =
    topScore === 0 ? "standalone" : (winner as FiveMFramework);

  const confidence: FrameworkDetection["confidence"] =
    topScore >= 4 ? "high" : topScore >= 2 && topScore > secondScore ? "medium" : "low";

  const usesOxLib =
    haystack.includes("ox_lib") ||
    haystack.includes("@ox_lib/init.lua") ||
    resources.some((r) => r.toLowerCase().includes("ox_lib"));

  return {
    framework,
    confidence,
    signals: [...new Set(signals)],
    usesOxLib,
  };
}

export function getResourceNameFromPath(
  filePath: string,
  projectRoot: string,
  manifest?: FxManifest,
): string | null {
  if (manifest?.name) return manifest.name;

  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedRoot = projectRoot.replace(/\\/g, "/");

  if (normalizedFile.startsWith(normalizedRoot)) {
    const relative = normalizedFile.slice(normalizedRoot.length).replace(/^\//, "");
    const firstSegment = relative.split("/")[0];
    if (firstSegment && !firstSegment.includes(".")) return firstSegment;
  }

  const parts = normalizedFile.split("/");
  const fxIndex = parts.lastIndexOf("fxmanifest.lua");
  if (fxIndex > 0) return parts[fxIndex - 1];

  return parts.at(-2) ?? null;
}

export function buildExportCompletions(
  detection: FrameworkDetection,
): ExportCompletion[] {
  const completions: ExportCompletion[] = [];

  if (detection.usesOxLib) {
    const oxLibMethods = [
      ["lib.notify", 'lib.notify({ title = "Title", description = "Message", type = "inform" })'],
      ["lib.alertDialog", 'lib.alertDialog({ header = "Confirm", content = "Are you sure?", centered = true })'],
      ["lib.inputDialog", 'lib.inputDialog("Input", { { type = "input", label = "Value" } })'],
      ["lib.registerContext", "lib.registerContext({ id = \"menu\", title = \"Menu\", options = {} })"],
      ["lib.showContext", 'lib.showContext("menu")'],
      ["lib.callback.await", 'lib.callback.await("resource:callback", false, arg1)'],
      ["lib.progressBar", 'lib.progressBar({ duration = 5000, label = "Loading..." })'],
      ["lib.skillCheck", 'lib.skillCheck({"easy", "medium"})'],
    ] as const;

    for (const [label, insertText] of oxLibMethods) {
      completions.push({
        label,
        insertText,
        detail: "ox_lib",
        documentation: `**ox_lib** global\n\`${insertText}\``,
        sortText: `0-${label}`,
      });
    }

    completions.push({
      label: "exports.ox_inventory",
      insertText: "exports.ox_inventory:AddItem(source, 'item', 1)",
      detail: "ox_inventory export",
      documentation: "Ajoute un item via ox_inventory",
      sortText: "0-ox_inventory",
    });
  }

  if (detection.framework === "qbcore") {
    completions.push(
      {
        label: "QBCore",
        insertText: "local QBCore = exports['qb-core']:GetCoreObject()",
        detail: "QBCore bootstrap",
        documentation: "Initialise QBCore dans un script client/server",
        sortText: "1-QBCore",
      },
      {
        label: "QBCore.Functions.GetPlayer",
        insertText: "QBCore.Functions.GetPlayer(source)",
        detail: "QBCore server",
        documentation: "Récupère le joueur côté serveur",
        sortText: "1-GetPlayer",
      },
      {
        label: "QBCore.Functions.Notify",
        insertText: 'QBCore.Functions.Notify("Message", "success")',
        detail: "QBCore notify",
        documentation: "Notification QBCore",
        sortText: "1-Notify",
      },
      {
        label: "QBCore.Functions.TriggerCallback",
        insertText: 'QBCore.Functions.TriggerCallback("resource:callback", function(result) end, arg1)',
        detail: "QBCore client callback",
        documentation: "Déclenche un callback serveur depuis le client",
        sortText: "1-TriggerCallback",
      },
    );
  }

  if (detection.framework === "qbox") {
    completions.push(
      {
        label: "QBX",
        insertText: "local QBX = exports.qbx_core:GetCoreObject()",
        detail: "Qbox bootstrap",
        documentation: "Initialise Qbox",
        sortText: "1-QBX",
      },
      {
        label: "exports.qbx_core:GetPlayer",
        insertText: "exports.qbx_core:GetPlayer(source)",
        detail: "Qbox server",
        documentation: "Récupère le joueur Qbox",
        sortText: "1-qbx_GetPlayer",
      },
    );
  }

  if (detection.framework === "esx") {
    completions.push(
      {
        label: "ESX",
        insertText: "local ESX = exports.es_extended:getSharedObject()",
        detail: "ESX bootstrap",
        documentation: "Initialise ESX",
        sortText: "1-ESX",
      },
      {
        label: "ESX.ShowNotification",
        insertText: 'ESX.ShowNotification("Message")',
        detail: "ESX notify",
        documentation: "Notification ESX",
        sortText: "1-ESX_Notify",
      },
      {
        label: "ESX.TriggerServerCallback",
        insertText: 'ESX.TriggerServerCallback("resource:callback", function(result) end, arg1)',
        detail: "ESX client callback",
        documentation: "Callback serveur ESX",
        sortText: "1-ESX_Callback",
      },
    );
  }

  return completions;
}