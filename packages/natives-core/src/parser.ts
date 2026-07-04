import type { NativeFunction, NativeParam } from "./types.js";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
const HEADING_RE = /^##\s+([A-Z0-9_]+)/m;
const C_BLOCK_RE = /```c\s*\n([\s\S]*?)```/;
const HASH_LINE_RE = /\/\/\s*(0x[0-9A-Fa-f]+)(?:\s+(0x[0-9A-Fa-f]+))?/;
const SIGNATURE_RE = /^([A-Za-z_*][\w*]*)\s+([A-Z0-9_]+)\(([^)]*)\);/m;

export function toLuaName(nativeName: string): string {
  return nativeName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function parseParams(block: string): NativeParam[] {
  const section = block.match(/## Parameters\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  if (!section) return [];

  const params: NativeParam[] = [];
  for (const line of section[1].split("\n")) {
    const match = line.match(/^\*\s+\*\*([^*]+)\*\*:\s*(.*)$/);
    if (!match) continue;
    params.push({
      name: match[1].trim(),
      type: "Any",
      description: match[2].trim() || undefined,
    });
  }
  return params;
}

function parseDescription(block: string): string {
  const cBlockEnd = block.indexOf("```", block.indexOf("```c") + 4);
  if (cBlockEnd === -1) return "";

  const afterC = block.slice(cBlockEnd + 3).trim();
  const nextSection = afterC.search(/\n## /);
  const raw = nextSection === -1 ? afterC : afterC.slice(0, nextSection);
  return raw.replace(/^```[\s\S]*?```/gm, "").trim();
}

function parseExamples(block: string): string | undefined {
  const section = block.match(/## Examples\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  if (!section) return undefined;

  const code = section[1].match(/```lua\s*\n([\s\S]*?)```/);
  return code?.[1].trim();
}

function parseSignatureTypes(signatureLine: string, paramSection: NativeParam[]): {
  returnType: string;
  params: NativeParam[];
} {
  const match = signatureLine.match(SIGNATURE_RE);
  if (!match) {
    return { returnType: "void", params: paramSection };
  }

  const returnType = match[1].replace(/\*/g, "").trim();
  const rawParams = match[3].trim();

  if (!rawParams) {
    return { returnType, params: [] };
  }

  const typedParams = rawParams.split(",").map((chunk, index) => {
    const trimmed = chunk.trim();
    const typeMatch = trimmed.match(/^([\w\s*]+?)\s+(\w+)$/);
    const fallback = paramSection[index];

    if (!typeMatch) {
      return (
        fallback ?? {
          name: `param${index}`,
          type: "Any",
        }
      );
    }

    return {
      name: typeMatch[2],
      type: typeMatch[1].replace(/\s+/g, "").replace(/\*/g, ""),
      description: fallback?.description,
    };
  });

  return { returnType, params: typedParams };
}

export function parseNativeMarkdown(
  content: string,
  namespace: string,
  fileName: string,
): NativeFunction | null {
  const frontmatter = content.match(FRONTMATTER_RE);
  const ns =
    frontmatter?.[1].match(/ns:\s*(\w+)/)?.[1] ?? namespace;

  const heading = content.match(HEADING_RE)?.[1];
  const name =
    heading ??
    fileName
      .replace(/\.md$/, "")
      .replace(/^N_0x/i, "")
      .toUpperCase();

  const cBlock = content.match(C_BLOCK_RE)?.[1];
  if (!cBlock) return null;

  const hashMatch = cBlock.match(HASH_LINE_RE);
  const signatureLine = cBlock
    .split("\n")
    .map((line) => line.trim())
    .find((line) => SIGNATURE_RE.test(line));

  if (!signatureLine) return null;

  const paramSection = parseParams(content);
  const { returnType, params } = parseSignatureTypes(signatureLine, paramSection);
  const description = parseDescription(content);
  const examples = parseExamples(content);

  return {
    id: `${ns}/${name}`,
    name,
    luaName: toLuaName(name),
    namespace: ns,
    hash: hashMatch?.[1] ?? "",
    altHash: hashMatch?.[2],
    signature: signatureLine.trim(),
    returnType,
    params,
    description,
    examples,
  };
}