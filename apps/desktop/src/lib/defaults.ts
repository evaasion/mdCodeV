export const DEFAULT_LUA = `-- mdcodeV — FiveM Lua
-- Commence à taper une native (ex: CreateVehicle, GetHashKey)

local playerPed = PlayerPedId()
local coords = GetEntityCoords(playerPed)

print(('Position: %.2f, %.2f, %.2f'):format(coords.x, coords.y, coords.z))
`;