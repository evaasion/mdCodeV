import type { ScaffoldKind, ScaffoldTemplate } from "./types.js";

function resourceName(kind: ScaffoldKind, customName?: string): string {
  if (customName) return customName.toLowerCase().replace(/\s+/g, "-");
  return kind.replace(/-/g, "_");
}

export function buildScaffold(
  kind: ScaffoldKind,
  customName?: string,
): ScaffoldTemplate {
  const name = resourceName(kind, customName);

  const templates: Record<ScaffoldKind, ScaffoldTemplate> = {
    "resource-basic": {
      kind,
      label: "Ressource basique",
      description: "fxmanifest + client/server Lua vides",
      files: {
        "fxmanifest.lua": `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${name}'
description 'Created with mdcodeV'
version '1.0.0'

client_scripts { 'client.lua' }
server_scripts { 'server.lua' }
`,
        "client.lua": `-- ${name} client
local function init()
    print('[${name}] client loaded')
end

CreateThread(function()
    init()
end)
`,
        "server.lua": `-- ${name} server
local function init()
    print('[${name}] server loaded')
end

CreateThread(function()
    init()
end)
`,
      },
    },
    "job-qbcore": {
      kind,
      label: "Job QBCore",
      description: "Structure job avec events et duty toggle",
      files: {
        "fxmanifest.lua": `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${name}'
description 'QBCore job - mdcodeV'
version '1.0.0'

shared_scripts { '@qb-core/shared/locale.lua', 'config.lua' }
client_scripts { 'client.lua' }
server_scripts { 'server.lua' }

dependencies { 'qb-core' }
`,
        "config.lua": `Config = {}

Config.JobName = '${name}'
Config.DutyEvent = '${name}:server:toggleDuty'
`,
        "client.lua": `local QBCore = exports['qb-core']:GetCoreObject()
local onDuty = false

RegisterNetEvent('${name}:client:setDuty', function(state)
    onDuty = state
    lib.notify({ title = Config.JobName, description = state and 'En service' or 'Hors service', type = 'inform' })
end)

RegisterCommand('${name}duty', function()
    TriggerServerEvent(Config.DutyEvent)
end)
`,
        "server.lua": `local QBCore = exports['qb-core']:GetCoreObject()

RegisterNetEvent('${name}:server:toggleDuty', function()
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local duty = not Player.PlayerData.job.onduty
    Player.Functions.SetJobDuty(duty)
    TriggerClientEvent('${name}:client:setDuty', src, duty)
end)
`,
      },
    },
    "shop-ox": {
      kind,
      label: "Shop ox_lib",
      description: "Menu shop avec ox_lib context",
      files: {
        "fxmanifest.lua": `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${name}'
description 'ox_lib shop - mdcodeV'
version '1.0.0'

shared_scripts { '@ox_lib/init.lua', 'config.lua' }
client_scripts { 'client.lua' }
server_scripts { 'server.lua' }

dependencies { 'ox_lib' }
`,
        "config.lua": `Config = {}

Config.ShopItems = {
    { label = 'Eau', name = 'water', price = 5 },
    { label = 'Pain', name = 'bread', price = 8 },
}
`,
        "client.lua": `local function openShop()
    local options = {}

    for _, item in ipairs(Config.ShopItems) do
        options[#options + 1] = {
            title = item.label,
            description = ('$%s'):format(item.price),
            onSelect = function()
                TriggerServerEvent('${name}:server:buy', item.name, item.price)
            end,
        }
    end

    lib.registerContext({ id = '${name}_shop', title = '${name}', options = options })
    lib.showContext('${name}_shop')
end

RegisterCommand('${name}', function()
    openShop()
end)
`,
        "server.lua": `RegisterNetEvent('${name}:server:buy', function(itemName, price)
    local src = source
    -- TODO: brancher ton framework (QBCore / ESX / ox_inventory)
    print(('[%s] %s veut acheter %s pour $%s'):format('${name}', src, itemName, price))
end)
`,
      },
    },
    "hud-nui": {
      kind,
      label: "HUD NUI",
      description: "Ressource NUI React-ready avec callback",
      files: {
        "fxmanifest.lua": `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${name}'
description 'NUI HUD - mdcodeV'
version '1.0.0'

ui_page 'html/index.html'

client_scripts { 'client.lua' }

files {
    'html/index.html',
    'html/style.css',
    'html/app.js',
}
`,
        "client.lua": `local visible = false

local function setVisible(state)
    visible = state
    SetNuiFocus(state, state)
    SendNUIMessage({ action = 'visibility', visible = state })
end

RegisterCommand('${name}', function()
    setVisible(not visible)
end)

RegisterNUICallback('close', function(_, cb)
    setVisible(false)
    cb({ ok = true })
end)
`,
        "html/index.html": `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="hud" class="hidden">
    <h1>${name}</h1>
    <button id="close">Fermer</button>
  </div>
  <script src="app.js"></script>
</body>
</html>
`,
        "html/style.css": `body { margin: 0; font-family: sans-serif; }
#hud { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.45); color: white; }
.hidden { display: none !important; }
`,
        "html/app.js": `const hud = document.getElementById('hud');
window.addEventListener('message', (e) => {
  if (e.data?.action === 'visibility') hud.classList.toggle('hidden', !e.data.visible);
});
document.getElementById('close').onclick = () => fetch('https://${name}/close', { method: 'POST', body: '{}' });
`,
      },
    },
  };

  return templates[kind];
}

export const SCAFFOLD_OPTIONS: { kind: ScaffoldKind; label: string; description: string }[] = [
  { kind: "resource-basic", label: "Ressource basique", description: "client + server Lua" },
  { kind: "job-qbcore", label: "Job QBCore", description: "duty toggle + events" },
  { kind: "shop-ox", label: "Shop ox_lib", description: "menu context shop" },
  { kind: "hud-nui", label: "HUD NUI", description: "interface NUI complète" },
];