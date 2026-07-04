import type { Monaco } from "@monaco-editor/react";
import type { ExportCompletion } from "@mdcodev/fivem-project";
import type { NativeFunction } from "@mdcodev/natives-core";
import {
  mergePluginCompletions,
  type LoadedPlugin,
  type PluginCompletion,
} from "@mdcodev/plugin-core";

type NativeIndex = {
  byLuaName: Map<string, NativeFunction>;
};

let registered = false;
let exportCompletions: ExportCompletion[] = [];
let pluginCompletions: PluginCompletion[] = [];

export function setExportCompletions(completions: ExportCompletion[]) {
  exportCompletions = completions;
}

export function setPluginCompletions(plugins: LoadedPlugin[]) {
  pluginCompletions = mergePluginCompletions(plugins);
}

function buildInsertText(native: NativeFunction): string {
  const args = native.params.map((param: NativeFunction["params"][number], index: number) => {
    if (param.name) return param.name;
    return `arg${index + 1}`;
  });
  return `${native.luaName}(${args.join(", ")})`;
}

function buildDocumentation(native: NativeFunction): string {
  const lines = [
    `**${native.namespace}** · \`${native.hash}\``,
    "",
    `\`\`\`c\n${native.signature}\n\`\`\``,
  ];

  if (native.description) {
    lines.push("", native.description);
  }

  if (native.params.length > 0) {
    lines.push("", "**Parameters**");
    for (const param of native.params) {
      lines.push(`- \`${param.name}\` (${param.type})${param.description ? `: ${param.description}` : ""}`);
    }
  }

  if (native.examples) {
    lines.push("", "**Example**", "```lua", native.examples, "```");
  }

  return lines.join("\n");
}

export function registerLuaLanguage(
  monaco: Monaco,
  nativeIndex: NativeIndex,
  onNativeSelect?: (native: NativeFunction) => void,
) {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: "fivem-lua" });

  monaco.languages.setMonarchTokensProvider("fivem-lua", {
    defaultToken: "",
    ignoreCase: false,
    tokenizer: {
      root: [
        [/--\[\[[\s\S]*?\]\]/, "comment"],
        [/--.*$/, "comment"],
        [/\b(local|function|end|if|then|else|elseif|return|for|while|do|repeat|until|in|and|or|not|nil|true|false|break)\b/, "keyword"],
        [/\b(lib\.[A-Za-z_][\w.]*)\b/, "export"],
        [/\b(QBCore|ESX|QBX)\b/, "export"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/\b[A-Z][A-Za-z0-9]*\b/, "native"],
        [/[a-zA-Z_]\w*/, "identifier"],
      ],
    },
  });

  monaco.languages.registerCompletionItemProvider("fivem-lua", {
    triggerCharacters: ["(", ",", " ", ".", "'"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const nativeSuggestions = [...nativeIndex.byLuaName.values()].map((native) => ({
        label: native.luaName,
        kind: monaco.languages.CompletionItemKind.Function,
        detail: `${native.namespace} → ${native.returnType}`,
        documentation: { value: buildDocumentation(native) },
        insertText: buildInsertText(native),
        range,
        sortText: `2-${native.luaName}`,
      }));

      const exportSuggestions = exportCompletions.map((item) => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        detail: item.detail,
        documentation: { value: item.documentation },
        insertText: item.insertText,
        range,
        sortText: item.sortText,
      }));

      const pluginSuggestions = pluginCompletions.map((item) => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        detail: item.detail ?? "plugin",
        documentation: { value: item.documentation ?? item.label },
        insertText: item.insertText,
        range,
        sortText: `1-${item.label}`,
      }));

      return {
        suggestions: [...pluginSuggestions, ...exportSuggestions, ...nativeSuggestions],
      };
    },
  });

  monaco.languages.registerHoverProvider("fivem-lua", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const native = nativeIndex.byLuaName.get(word.word);
      if (native) {
        onNativeSelect?.(native);
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: buildDocumentation(native) }],
        };
      }

      const exportMatch = exportCompletions.find(
        (item) => item.label === word.word || item.label.startsWith(`${word.word}.`),
      );
      if (exportMatch) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: exportMatch.documentation }],
        };
      }

      const pluginMatch = pluginCompletions.find(
        (item) => item.label === word.word || item.label.startsWith(`${word.word}.`),
      );
      if (pluginMatch) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: pluginMatch.documentation ?? pluginMatch.label }],
        };
      }

      return null;
    },
  });
}