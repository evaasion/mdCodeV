import type { NativeFunction, NativesDatabase } from "./types.js";

export type { NativeFunction, NativeParam, NativesDatabase } from "./types.js";
export { parseNativeMarkdown, toLuaName } from "./parser.js";

export function createNativeIndex(database: NativesDatabase) {
  const byLuaName = new Map<string, NativeFunction>();
  const byNamespace = new Map<string, NativeFunction[]>();

  for (const native of database.natives) {
    byLuaName.set(native.luaName, native);
    const bucket = byNamespace.get(native.namespace) ?? [];
    bucket.push(native);
    byNamespace.set(native.namespace, bucket);
  }

  for (const bucket of byNamespace.values()) {
    bucket.sort((a, b) => a.luaName.localeCompare(b.luaName));
  }

  return { byLuaName, byNamespace };
}

export function searchNatives(
  database: NativesDatabase,
  query: string,
  limit = 50,
): NativeFunction[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return database.natives.slice(0, limit);

  const results: NativeFunction[] = [];
  for (const native of database.natives) {
    const haystack = [
      native.luaName,
      native.name,
      native.namespace,
      native.description,
      native.hash,
    ]
      .join(" ")
      .toLowerCase();

    if (haystack.includes(needle)) {
      results.push(native);
      if (results.length >= limit) break;
    }
  }

  return results;
}