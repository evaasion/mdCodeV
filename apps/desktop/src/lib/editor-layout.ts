export type SplitDirection = "horizontal" | "vertical";
export type DropZone = "left" | "right" | "top" | "bottom" | "center";

export interface EditorGroupState {
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export type LayoutNode =
  | { kind: "group"; id: string }
  | {
      kind: "split";
      id: string;
      direction: SplitDirection;
      children: LayoutNode[];
      ratios: number[];
    };

export interface EditorWorkspaceLayout {
  root: LayoutNode;
  groups: Record<string, EditorGroupState>;
  focusedGroupId: string;
}

function newId(): string {
  return crypto.randomUUID();
}

function normalizeRatios(ratios: number[]): number[] {
  const sum = ratios.reduce((acc, value) => acc + value, 0) || 1;
  return ratios.map((value) => value / sum);
}

function normalizeLayout(
  node: LayoutNode,
  groups: Record<string, EditorGroupState>,
): LayoutNode | null {
  if (node.kind === "group") {
    const group = groups[node.id];
    if (!group || group.tabIds.length === 0) return null;
    return node;
  }

  const children: LayoutNode[] = [];
  const ratios: number[] = [];
  node.children.forEach((child, index) => {
    const normalized = normalizeLayout(child, groups);
    if (normalized) {
      children.push(normalized);
      ratios.push(node.ratios[index] ?? 1);
    }
  });

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];

  return {
    ...node,
    children,
    ratios: normalizeRatios(ratios),
  };
}

function replaceGroupNode(
  node: LayoutNode,
  groupId: string,
  replacement: LayoutNode,
): LayoutNode {
  if (node.kind === "group") {
    return node.id === groupId ? replacement : node;
  }
  return {
    ...node,
    children: node.children.map((child) => replaceGroupNode(child, groupId, replacement)),
  };
}

function removeGroupFromTree(node: LayoutNode, groupId: string): LayoutNode | null {
  if (node.kind === "group") {
    return node.id === groupId ? null : node;
  }

  const children: LayoutNode[] = [];
  const ratios: number[] = [];
  node.children.forEach((child, index) => {
    const next = removeGroupFromTree(child, groupId);
    if (next) {
      children.push(next);
      ratios.push(node.ratios[index] ?? 1);
    }
  });

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];

  return {
    ...node,
    children,
    ratios: normalizeRatios(ratios),
  };
}

function updateSplitNode(
  node: LayoutNode,
  splitId: string,
  updater: (split: Extract<LayoutNode, { kind: "split" }>) => LayoutNode,
): LayoutNode {
  if (node.kind === "group") return node;
  if (node.id === splitId) return updater(node);
  return {
    ...node,
    children: node.children.map((child) => updateSplitNode(child, splitId, updater)),
  };
}

function finalizeLayout(
  layout: EditorWorkspaceLayout,
  root: LayoutNode | null,
  groups: Record<string, EditorGroupState>,
  focusedGroupId: string,
): EditorWorkspaceLayout {
  const prunedGroups = { ...groups };
  for (const groupId of Object.keys(prunedGroups)) {
    if (prunedGroups[groupId].tabIds.length === 0) {
      delete prunedGroups[groupId];
    }
  }

  let nextRoot = root ? normalizeLayout(root, prunedGroups) : null;
  const groupIds = Object.keys(prunedGroups);

  if (!nextRoot && groupIds.length > 0) {
    nextRoot = { kind: "group", id: groupIds[0] };
  }

  let nextFocused = focusedGroupId;
  if (!prunedGroups[nextFocused]) {
    nextFocused = groupIds[0] ?? nextFocused;
  }

  return {
    root: nextRoot ?? layout.root,
    groups: prunedGroups,
    focusedGroupId: nextFocused,
  };
}

export function createInitialWorkspace(initialTabId: string): EditorWorkspaceLayout {
  const groupId = newId();
  return {
    root: { kind: "group", id: groupId },
    groups: {
      [groupId]: { id: groupId, tabIds: [initialTabId], activeTabId: initialTabId },
    },
    focusedGroupId: groupId,
  };
}

export function findGroupForTab(
  layout: EditorWorkspaceLayout,
  tabId: string,
): string | null {
  for (const group of Object.values(layout.groups)) {
    if (group.tabIds.includes(tabId)) return group.id;
  }
  return null;
}

export function getFocusedActiveTabId(layout: EditorWorkspaceLayout): string | null {
  return layout.groups[layout.focusedGroupId]?.activeTabId ?? null;
}

export function focusGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
): EditorWorkspaceLayout {
  if (!layout.groups[groupId]) return layout;
  return { ...layout, focusedGroupId: groupId };
}

export function setGroupActiveTab(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
): EditorWorkspaceLayout {
  const group = layout.groups[groupId];
  if (!group?.tabIds.includes(tabId)) return layout;
  return {
    ...layout,
    focusedGroupId: groupId,
    groups: {
      ...layout.groups,
      [groupId]: { ...group, activeTabId: tabId },
    },
  };
}

export function addTabToGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
): EditorWorkspaceLayout {
  const group = layout.groups[groupId];
  if (!group || group.tabIds.includes(tabId)) {
    return setGroupActiveTab(layout, groupId, tabId);
  }
  return setGroupActiveTab(
    {
      ...layout,
      groups: {
        ...layout.groups,
        [groupId]: { ...group, tabIds: [...group.tabIds, tabId] },
      },
    },
    groupId,
    tabId,
  );
}

export function addTabToFocusedGroup(
  layout: EditorWorkspaceLayout,
  tabId: string,
): EditorWorkspaceLayout {
  return addTabToGroup(layout, layout.focusedGroupId, tabId);
}

export function reorderTabInGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
  targetIndex: number,
): EditorWorkspaceLayout {
  const group = layout.groups[groupId];
  if (!group) return layout;

  const currentIndex = group.tabIds.indexOf(tabId);
  if (currentIndex < 0) return layout;

  const tabIds = [...group.tabIds];
  tabIds.splice(currentIndex, 1);
  const clampedIndex = Math.max(0, Math.min(targetIndex, tabIds.length));
  tabIds.splice(clampedIndex, 0, tabId);

  return {
    ...layout,
    groups: {
      ...layout.groups,
      [groupId]: { ...group, tabIds },
    },
  };
}

export function moveTabToGroup(
  layout: EditorWorkspaceLayout,
  tabId: string,
  fromGroupId: string,
  toGroupId: string,
  targetIndex?: number,
): EditorWorkspaceLayout {
  if (fromGroupId === toGroupId) {
    if (targetIndex === undefined) return layout;
    return reorderTabInGroup(layout, fromGroupId, tabId, targetIndex);
  }

  const source = layout.groups[fromGroupId];
  const target = layout.groups[toGroupId];
  if (!source?.tabIds.includes(tabId) || !target) return layout;

  const sourceTabIds = source.tabIds.filter((id) => id !== tabId);
  let sourceActive = source.activeTabId;
  if (sourceActive === tabId) {
    sourceActive = sourceTabIds[sourceTabIds.length - 1] ?? null;
  }

  const targetTabIds = [...target.tabIds];
  const insertAt =
    targetIndex === undefined
      ? targetTabIds.length
      : Math.max(0, Math.min(targetIndex, targetTabIds.length));
  if (!targetTabIds.includes(tabId)) {
    targetTabIds.splice(insertAt, 0, tabId);
  }

  const groups = {
    ...layout.groups,
    [fromGroupId]: { ...source, tabIds: sourceTabIds, activeTabId: sourceActive },
    [toGroupId]: { ...target, tabIds: targetTabIds, activeTabId: tabId },
  };

  let root = layout.root;
  if (sourceTabIds.length === 0) {
    root = removeGroupFromTree(root, fromGroupId) ?? root;
  }

  return finalizeLayout(layout, root, groups, toGroupId);
}

export function splitGroupWithTab(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
  direction: SplitDirection,
  side: "before" | "after",
): EditorWorkspaceLayout {
  const source = layout.groups[groupId];
  if (!source?.tabIds.includes(tabId)) return layout;

  const newGroupId = newId();
  const sourceTabIds = source.tabIds.filter((id) => id !== tabId);
  let sourceActive = source.activeTabId;
  if (sourceActive === tabId) {
    sourceActive = sourceTabIds[sourceTabIds.length - 1] ?? null;
  }

  const groups: Record<string, EditorGroupState> = {
    ...layout.groups,
    [newGroupId]: { id: newGroupId, tabIds: [tabId], activeTabId: tabId },
  };

  const newGroupNode: LayoutNode = { kind: "group", id: newGroupId };

  if (sourceTabIds.length === 0) {
    delete groups[groupId];
    const root = replaceGroupNode(layout.root, groupId, newGroupNode);
    return finalizeLayout(layout, root, groups, newGroupId);
  }

  groups[groupId] = { ...source, tabIds: sourceTabIds, activeTabId: sourceActive };

  const oldGroupNode: LayoutNode = { kind: "group", id: groupId };
  const splitNode: LayoutNode = {
    kind: "split",
    id: newId(),
    direction,
    children:
      side === "before" ? [newGroupNode, oldGroupNode] : [oldGroupNode, newGroupNode],
    ratios: [0.5, 0.5],
  };

  const root = replaceGroupNode(layout.root, groupId, splitNode);
  return finalizeLayout(layout, root, groups, newGroupId);
}

export function duplicateActiveTabInSplit(
  layout: EditorWorkspaceLayout,
  tabId: string,
): EditorWorkspaceLayout {
  const groupId = layout.focusedGroupId;
  const group = layout.groups[groupId];
  if (!group?.tabIds.includes(tabId)) return layout;

  const newGroupId = newId();
  const groups: Record<string, EditorGroupState> = {
    ...layout.groups,
    [newGroupId]: { id: newGroupId, tabIds: [tabId], activeTabId: tabId },
  };

  const splitNode: LayoutNode = {
    kind: "split",
    id: newId(),
    direction: "vertical",
    children: [
      { kind: "group", id: groupId },
      { kind: "group", id: newGroupId },
    ],
    ratios: [0.5, 0.5],
  };

  const root = replaceGroupNode(layout.root, groupId, splitNode);
  return finalizeLayout(layout, root, groups, newGroupId);
}

export function closeTabInGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
): { layout: EditorWorkspaceLayout; tabFullyClosed: boolean } {
  const group = layout.groups[groupId];
  if (!group) return { layout, tabFullyClosed: false };

  const tabIds = group.tabIds.filter((id) => id !== tabId);
  let activeTabId = group.activeTabId;
  if (activeTabId === tabId) {
    activeTabId = tabIds[tabIds.length - 1] ?? null;
  }

  const groups = {
    ...layout.groups,
    [groupId]: { ...group, tabIds, activeTabId },
  };

  let root = layout.root;
  if (tabIds.length === 0) {
    root = removeGroupFromTree(root, groupId) ?? root;
  }

  const tabStillOpen = Object.values(groups).some((entry) => entry.tabIds.includes(tabId));
  const nextLayout = finalizeLayout(layout, root, groups, groupId);

  return {
    layout: tabStillOpen ? nextLayout : nextLayout,
    tabFullyClosed: !tabStillOpen,
  };
}

export function setSplitRatios(
  layout: EditorWorkspaceLayout,
  splitId: string,
  ratios: number[],
): EditorWorkspaceLayout {
  const root = updateSplitNode(layout.root, splitId, (split) => {
    if (split.children.length !== ratios.length) return split;
    return { ...split, ratios: normalizeRatios(ratios) };
  });
  return { ...layout, root };
}

export function dropZoneFromPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): DropZone {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const edge = 0.22;

  if (x < edge) return "left";
  if (x > 1 - edge) return "right";
  if (y < edge) return "top";
  if (y > 1 - edge) return "bottom";
  return "center";
}

export function dropZoneToSplit(
  zone: DropZone,
): { direction: SplitDirection; side: "before" | "after" } | null {
  switch (zone) {
    case "left":
      return { direction: "horizontal", side: "before" };
    case "right":
      return { direction: "horizontal", side: "after" };
    case "top":
      return { direction: "vertical", side: "before" };
    case "bottom":
      return { direction: "vertical", side: "after" };
    default:
      return null;
  }
}