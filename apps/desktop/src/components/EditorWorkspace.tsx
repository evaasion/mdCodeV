import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { NativeFunction } from "@mdcodev/natives-core";
import type { LintDiagnostic } from "@mdcodev/linter-core";
import type { EditorTab } from "../lib/editor";
import type { AppTheme } from "../lib/appearance";
import type {
  DropZone,
  EditorWorkspaceLayout,
  LayoutNode,
  SplitDirection,
} from "../lib/editor-layout";
import {
  dropZoneToSplit,
  focusGroup,
  moveTabToGroup,
  setGroupActiveTab,
  setSplitRatios,
  splitGroupWithTab,
} from "../lib/editor-layout";
import { EditorGroup, type TabDragPayload } from "./EditorGroup";
import styles from "./EditorWorkspace.module.css";

interface EditorWorkspaceProps {
  appTheme: AppTheme;
  layout: EditorWorkspaceLayout;
  tabs: EditorTab[];
  tabMap: Map<string, EditorTab>;
  diagnostics: LintDiagnostic[];
  revealLine?: number | null;
  nativeIndex: {
    byLuaName: Map<string, NativeFunction>;
  };
  onLayoutChange: (layout: EditorWorkspaceLayout) => void;
  onTabChange: (tabId: string, value: string) => void;
  onTabClose: (groupId: string, tabId: string) => void;
  onNativeSelect: (native: NativeFunction) => void;
}

export function EditorWorkspace({
  appTheme,
  layout,
  tabs,
  tabMap,
  diagnostics,
  revealLine,
  nativeIndex,
  onLayoutChange,
  onTabChange,
  onTabClose,
  onNativeSelect,
}: EditorWorkspaceProps) {
  const [dragPayload, setDragPayload] = useState<TabDragPayload | null>(null);
  const layoutRef = useRef(layout);
  const resizeRef = useRef<{
    splitId: string;
    index: number;
    direction: SplitDirection;
    startPos: number;
    startRatios: number[];
    containerSize: number;
  } | null>(null);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const handleGroupDropTab = useCallback(
    (groupId: string, payload: TabDragPayload, zone: DropZone, targetIndex?: number) => {
      const { tabId, groupId: fromGroupId } = payload;

      if (zone === "center") {
        onLayoutChange(moveTabToGroup(layout, tabId, fromGroupId, groupId, targetIndex));
        return;
      }

      const split = dropZoneToSplit(zone);
      if (!split) return;

      onLayoutChange(splitGroupWithTab(layout, groupId, tabId, split.direction, split.side));
    },
    [layout, onLayoutChange],
  );

  function startResize(
    splitId: string,
    index: number,
    direction: SplitDirection,
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    const splitNode = findSplitNode(layout.root, splitId);
    if (!splitNode) return;

    const container = event.currentTarget.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    resizeRef.current = {
      splitId,
      index,
      direction,
      startPos: direction === "horizontal" ? event.clientX : event.clientY,
      startRatios: [...splitNode.ratios],
      containerSize: direction === "horizontal" ? rect.width : rect.height,
    };

    function onMove(moveEvent: MouseEvent) {
      const state = resizeRef.current;
      if (!state) return;

      const currentPos = state.direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      const delta = (currentPos - state.startPos) / state.containerSize;
      const ratios = [...state.startRatios];
      const left = Math.max(0.12, Math.min(0.88, ratios[state.index] + delta));
      const right = Math.max(0.12, Math.min(0.88, ratios[state.index + 1] - delta));
      const total = left + right;
      ratios[state.index] = left / total;
      ratios[state.index + 1] = right / total;

      onLayoutChange(setSplitRatios(layoutRef.current, state.splitId, ratios));
    }

    function onUp() {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function renderGroup(groupId: string) {
    const group = layout.groups[groupId];
    if (!group) return null;

    const groupTabs = group.tabIds
      .map((tabId) => tabMap.get(tabId))
      .filter((tab): tab is EditorTab => !!tab);

    const showDiagnostics =
      groupId === layout.focusedGroupId &&
      group.activeTabId === layout.groups[layout.focusedGroupId]?.activeTabId;

    return (
      <EditorGroup
        key={groupId}
        groupId={groupId}
        focused={layout.focusedGroupId === groupId}
        appTheme={appTheme}
        tabs={groupTabs}
        activeTabId={group.activeTabId}
        dragPayload={dragPayload}
        diagnostics={showDiagnostics ? diagnostics : []}
        revealLine={showDiagnostics ? revealLine : null}
        nativeIndex={nativeIndex}
        onFocus={() => onLayoutChange(focusGroup(layout, groupId))}
        onTabChange={(tabId) => onLayoutChange(setGroupActiveTab(layout, groupId, tabId))}
        onTabClose={(tabId) => onTabClose(groupId, tabId)}
        onChange={onTabChange}
        onNativeSelect={onNativeSelect}
        onTabDragStart={setDragPayload}
        onTabDragEnd={() => setDragPayload(null)}
        onDropTab={(payload, zone, targetIndex) =>
          handleGroupDropTab(groupId, payload, zone, targetIndex)
        }
      />
    );
  }

  function renderNode(node: LayoutNode): React.ReactNode {
    if (node.kind === "group") {
      return renderGroup(node.id);
    }

    const flexDirection = node.direction === "horizontal" ? "row" : "column";

    return (
      <div className={styles.split} style={{ flexDirection }}>
        {node.children.map((child, index) => (
          <Fragment key={child.kind === "group" ? child.id : child.id}>
            <div
              className={styles.splitChild}
              style={{ flexGrow: node.ratios[index] ?? 1, flexBasis: 0 }}
            >
              {renderNode(child)}
            </div>
            {index < node.children.length - 1 && (
              <div
                className={
                  node.direction === "horizontal"
                    ? styles.dividerVertical
                    : styles.dividerHorizontal
                }
                onMouseDown={(event) => startResize(node.id, index, node.direction, event)}
              />
            )}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      {renderNode(layout.root)}
      {tabs.length === 0 && (
        <div className={styles.emptyWorkspace}>Aucun éditeur ouvert</div>
      )}
    </div>
  );
}

function findSplitNode(
  node: LayoutNode,
  splitId: string,
): Extract<LayoutNode, { kind: "split" }> | null {
  if (node.kind === "group") return null;
  if (node.id === splitId) return node;
  for (const child of node.children) {
    const found = findSplitNode(child, splitId);
    if (found) return found;
  }
  return null;
}