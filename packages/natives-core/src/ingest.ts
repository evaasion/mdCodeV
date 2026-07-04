import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseNativeMarkdown } from "./parser.js";
import type { NativesDatabase } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "natives.json");

async function resolveSourceDir(): Promise<string> {
  const envSource = process.env.NATIVES_SOURCE;
  if (envSource) return envSource;

  const localClone = path.join(__dirname, "../../../.cache/citizenfx-natives");
  try {
    await readdir(localClone);
    return localClone;
  } catch {
    throw new Error(
      "Natives source not found. Clone https://github.com/citizenfx/natives into .cache/citizenfx-natives or set NATIVES_SOURCE.",
    );
  }
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const sourceDir = await resolveSourceDir();
  const markdownFiles = await walkMarkdownFiles(sourceDir);
  const natives = [];

  for (const filePath of markdownFiles) {
    const content = await readFile(filePath, "utf8");
    const namespace = path.basename(path.dirname(filePath));
    const fileName = path.basename(filePath);
    const parsed = parseNativeMarkdown(content, namespace, fileName);
    if (parsed) natives.push(parsed);
  }

  natives.sort((a, b) => a.luaName.localeCompare(b.luaName));

  const namespaces = [...new Set(natives.map((native) => native.namespace))].sort();

  const database: NativesDatabase = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "https://github.com/citizenfx/natives",
    count: natives.length,
    namespaces,
    natives,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(database, null, 2));

  console.log(`Ingested ${database.count} natives across ${namespaces.length} namespaces`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});