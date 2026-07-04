import { useEffect, useRef, useState } from "react";
import EditorBase, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { NativeFunction } from "@mdcodev/natives-core";
import type { LintDiagnostic } from "@mdcodev/linter-core";
import type { EditorTab } from "../lib/editor";
import { isTabDirty } from "../lib/editor";
import type { AppTheme } from "../lib/appearance";
import { monacoThemeId } from "../lib/appearance";
import type { DropZone } from "../lib/editor-layout";
import { dropZoneFromPoint } from "../lib/editor-layout";
import { registerLuaLanguage } from "../lib/monaco-lua";
import { registerMonacoThemes, setMonacoTheme } from "../lib/monaco-theme";
import styles from "./EditorGroup.module.css";

const EDITOR_BG: Record<AppTheme, string> = {
  dark: "#0d0f12",
  black: "#000000",
};

export interface TabDragPayload {
  tabId: string;
  groupId: string;
}

interface EditorGroupProps {
  groupId: string;
  focused: boolean;
  appTheme: AppTheme;
  tabs: EditorTab[];
  activeTabId: string | null;
  dragPayload: TabDragPayload | null;
  diagnostics: LintDiagnostic[];
  revealLine?: number | null;
  nativeIndex: {
    byLuaName: Map<string, NativeFunction>;
  };
  onFocus: () => void;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onChange: (tabId: string, value: string) => void;
  onNativeSelect: (native: NativeFunction) => void;
  onTabDragStart: (payload: TabDragPayload) => void;
  onTabDragEnd: () => void;
  onDropTab: (payload: TabDragPayload, zone: DropZone, targetIndex?: number) => void;
}

export function EditorGroup({
  groupId,
  focused,
  appTheme,
  tabs,
  activeTabId,
  dragPayload,
  diagnostics,
  revealLine,
  nativeIndex,
  onFocus,
  onTabChange,
  onTabClose,
  onChange,
  onNativeSelect,
  onTabDragStart,
  onTabDragEnd,
  onDropTab,
}: EditorGroupProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [tabDropIndex, setTabDropIndex] = useState<number | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeTab) return;

    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(
      model,
      "mdcodev",
      diagnostics.map((diagnostic) => ({
        startLineNumber: diagnostic.line,
        startColumn: diagnostic.column,
        endLineNumber: diagnostic.line,
        endColumn: diagnostic.endColumn ?? diagnostic.column + 1,
        message: diagnostic.message,
        severity:
          diagnostic.severity === "error"
            ? monaco.MarkerSeverity.Error
            : diagnostic.severity === "warning"
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
      })),
    );
  }, [diagnostics, activeTab]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !revealLine || !focused) return;
    editor.revealLineInCenter(revealLine);
    editor.setPosition({ lineNumber: revealLine, column: 1 });
    editor.focus();
  }, [revealLine, focused]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    setMonacoTheme(monaco, appTheme);
  }, [appTheme]);

  function handlePaneDragOver(event: React.DragEvent) {
    if (!dragPayload || !paneRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropZone(dropZoneFromPoint(paneRef.current.getBoundingClientRect(), event.clientX, event.clientY));
  }

  function handlePaneDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!dragPayload || !paneRef.current) return;
    const zone = dropZoneFromPoint(paneRef.current.getBoundingClientRect(), event.clientX, event.clientY);
    onDropTab(dragPayload, zone);
    setDropZone(null);
    onTabDragEnd();
  }

  function handleTabBarDragOver(event: React.DragEvent) {
    if (!dragPayload) return;
    event.preventDefault();
    const target = (event.target as HTMLElement).closest("[data-tab-index]");
    if (target) {
      setTabDropIndex(Number((target as HTMLElement).dataset.tabIndex));
    }
  }

  function handleTabBarDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!dragPayload) return;
    const index = tabDropIndex ?? tabs.length;
    onDropTab(dragPayload, "center", index);
    setTabDropIndex(null);
    onTabDragEnd();
  }

  return (
    <div
      ref={paneRef}
      className={focused ? styles.groupFocused : styles.group}
      onMouseDown={onFocus}
      onDragOver={handlePaneDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={handlePaneDrop}
    >
      <div
        className={styles.tabs}
        onDragOver={handleTabBarDragOver}
        onDragLeave={() => setTabDropIndex(null)}
        onDrop={handleTabBarDrop}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const dirty = isTabDirty(tab);
          const dropBefore = tabDropIndex === index;
          return (
            <div
              key={`${groupId}-${tab.id}`}
              data-tab-index={index}
              className={active ? styles.tabActive : styles.tab}
            >
              {dropBefore && <span className={styles.tabDropMarker} />}
              <button
                className={styles.tabBtn}
                draggable
                onClick={() => onTabChange(tab.id)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tab.id);
                  onTabDragStart({ tabId: tab.id, groupId });
                }}
                onDragEnd={onTabDragEnd}
              >
                <span className={styles.tabIcon}>◆</span>
                {tab.fileName}
                {dirty && <span className={styles.dirty}>•</span>}
              </button>
              <button
                className={styles.closeTab}
                onClick={() => onTabClose(tab.id)}
                aria-label={`Fermer ${tab.fileName}`}
              >
                ✕
              </button>
            </div>
          );
        })}
        {tabDropIndex === tabs.length && <span className={styles.tabDropMarkerEnd} />}
      </div>

      <div className={styles.monaco}>
        {activeTab ? (
          <EditorBase
            key={`${groupId}-${activeTab.id}`}
            height="100%"
            language={activeTab.language}
            path={`${groupId}:${activeTab.id}`}
            value={activeTab.content}
            theme={monacoThemeId(appTheme)}
            loading={
              <div className={styles.monacoLoading} style={{ background: EDITOR_BG[appTheme] }} />
            }
            beforeMount={(monaco) => registerMonacoThemes(monaco)}
            onChange={(next) => onChange(activeTab.id, next ?? "")}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
              setMonacoTheme(monaco, appTheme);
              if (activeTab.language === "fivem-lua") {
                registerLuaLanguage(monaco, nativeIndex, onNativeSelect);
              }
            }}
            options={{
              fontFamily: "JetBrains Mono, Fira Code, monospace",
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: true, scale: 0.8 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              padding: { top: 12 },
              bracketPairColorization: { enabled: true },
              suggest: {
                preview: true,
                showMethods: true,
                showFunctions: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: false,
              },
              wordBasedSuggestions: "off",
            }}
          />
        ) : (
          <div className={styles.emptyPane}>Glisse un onglet ici ou ouvre un fichier</div>
        )}
      </div>

      {dragPayload && dropZone && dropZone !== "center" && (
        <div className={styles.dropOverlay} aria-hidden>
          <div className={`${styles.dropZone} ${styles[`drop_${dropZone}`]}`} />
        </div>
      )}
    </div>
  );
}