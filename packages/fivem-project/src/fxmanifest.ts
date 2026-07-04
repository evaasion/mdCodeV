import type { FxManifest } from "./types.js";

function extractQuotedList(block: string): string[] {
  const results: string[] = [];
  for (const match of block.matchAll(/['"]([^'"]+)['"]/g)) {
    if (match[1]) results.push(match[1]);
  }
  return results;
}

function extractBlock(content: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*\\{([^}]*)\\}`, "s");
  const match = content.match(re);
  return match?.[1] ?? null;
}

function extractScalar(content: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s+['"]([^'"]+)['"]`);
  return content.match(re)?.[1];
}

function extractBoolean(content: string, key: string): boolean | undefined {
  const re = new RegExp(`${key}\\s+(true|false)`);
  const value = content.match(re)?.[1];
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function parseFxManifest(content: string): FxManifest {
  const clientBlock = extractBlock(content, "client_scripts?");
  const serverBlock = extractBlock(content, "server_scripts?");
  const sharedBlock = extractBlock(content, "shared_scripts?");
  const filesBlock = extractBlock(content, "files");
  const depsBlock = extractBlock(content, "dependencies");

  return {
    fxVersion: extractScalar(content, "fx_version"),
    game: extractScalar(content, "game"),
    name: extractScalar(content, "name"),
    description: extractScalar(content, "description"),
    author: extractScalar(content, "author"),
    version: extractScalar(content, "version"),
    clientScripts: clientBlock ? extractQuotedList(clientBlock) : [],
    serverScripts: serverBlock ? extractQuotedList(serverBlock) : [],
    sharedScripts: sharedBlock ? extractQuotedList(sharedBlock) : [],
    files: filesBlock ? extractQuotedList(filesBlock) : [],
    dependencies: depsBlock ? extractQuotedList(depsBlock) : [],
    lua54: extractBoolean(content, "lua54"),
  };
}