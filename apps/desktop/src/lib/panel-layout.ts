import type { MouseEvent as ReactMouseEvent } from "react";

export interface PanelLayout {
  sidebarWidth: number;
  bottomPanelHeight: number;
  detailWidth: number;
}

const STORAGE_KEY = "mdcodev.panel.layout";

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  sidebarWidth: 280,
  bottomPanelHeight: 280,
  detailWidth: 340,
};

export const PANEL_LIMITS = {
  sidebar: { min: 180, max: 560 },
  bottom: { min: 140, max: 720 },
  detail: { min: 280, max: 640 },
} as const;

export function clampPanel(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function loadPanelLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PANEL_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return {
      sidebarWidth: clampPanel(
        parsed.sidebarWidth ?? DEFAULT_PANEL_LAYOUT.sidebarWidth,
        PANEL_LIMITS.sidebar.min,
        PANEL_LIMITS.sidebar.max,
      ),
      bottomPanelHeight: clampPanel(
        parsed.bottomPanelHeight ?? DEFAULT_PANEL_LAYOUT.bottomPanelHeight,
        PANEL_LIMITS.bottom.min,
        PANEL_LIMITS.bottom.max,
      ),
      detailWidth: clampPanel(
        parsed.detailWidth ?? DEFAULT_PANEL_LAYOUT.detailWidth,
        PANEL_LIMITS.detail.min,
        PANEL_LIMITS.detail.max,
      ),
    };
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
}

export function savePanelLayout(layout: PanelLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function bindResizeDrag(
  event: ReactMouseEvent,
  cursor: "col-resize" | "row-resize",
  onMove: (moveEvent: MouseEvent) => void,
  onEnd?: () => void,
): void {
  event.preventDefault();
  document.body.style.userSelect = "none";
  document.body.style.cursor = cursor;

  function move(moveEvent: MouseEvent) {
    onMove(moveEvent);
  }

  function up() {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    onEnd?.();
  }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}