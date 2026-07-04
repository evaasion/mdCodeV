import { useEffect, useMemo, useState } from "react";
import { lintFiveMLua, type LintDiagnostic } from "@mdcodev/linter-core";
import { runPluginLintRules, type LoadedPlugin } from "@mdcodev/plugin-core";
import type { FrameworkDetection } from "@mdcodev/fivem-project";
import type { EditorTab } from "../lib/editor";

export function useLint(
  activeTab: EditorTab | null,
  knownNatives: Set<string>,
  frameworkDetection: FrameworkDetection | null,
  plugins: LoadedPlugin[] = [],
) {
  const [diagnostics, setDiagnostics] = useState<LintDiagnostic[]>([]);

  const code = activeTab?.content ?? "";
  const isLua = activeTab?.language === "fivem-lua";

  useEffect(() => {
    if (!isLua || !code.trim()) {
      setDiagnostics([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const base = lintFiveMLua(code, {
        knownNatives,
        framework: frameworkDetection?.framework,
        usesOxLib: frameworkDetection?.usesOxLib,
      });
      const pluginDiagnostics = runPluginLintRules(plugins, code);
      setDiagnostics([...base, ...pluginDiagnostics]);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [code, isLua, knownNatives, frameworkDetection, plugins]);

  const counts = useMemo(() => {
    return diagnostics.reduce(
      (acc, d) => {
        acc[d.severity] += 1;
        return acc;
      },
      { error: 0, warning: 0, info: 0 },
    );
  }, [diagnostics]);

  return { diagnostics, counts };
}