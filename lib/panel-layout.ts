export const MOBILE_MAX_WIDTH = 640;
export const SPLIT_PANEL_MIN_WIDTH = 960;

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;

export const RIGHT_PANEL_FALLBACK_WIDTH = 560;
export const RIGHT_PANEL_MIN_WIDTH = 300;
export const RIGHT_PANEL_MAX_WIDTH = 1200;

const COMPACT_CHAT_MIN_WIDTH = 320;
const DESKTOP_CHAT_MIN_WIDTH = 420;

export function clampPanelWidth(width: number, minWidth: number, maxWidth: number): number {
  const finiteWidth = Number.isFinite(width) ? width : minWidth;
  const effectiveMax = Math.max(minWidth, maxWidth);
  return Math.round(Math.max(minWidth, Math.min(effectiveMax, finiteWidth)));
}

export type PanelAxis = "x" | "y";
export type HorizontalGrowthDirection = "left" | "right";
export type VerticalGrowthDirection = "up" | "down";
export type PanelGrowthDirection = HorizontalGrowthDirection | VerticalGrowthDirection;
export type PanelResizeKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export interface PanelAxisBehavior {
  /** Body cursor held while the drag is active. */
  bodyCursor: "col-resize" | "row-resize";
  /** Pointer coordinate the drag reads. */
  coord: "clientX" | "clientY";
  growKey: PanelResizeKey;
  /** A horizontal separator splits vertically stacked panes, and vice versa. */
  separatorOrientation: "horizontal" | "vertical";
  shrinkKey: PanelResizeKey;
  /** Applied to a positive movement along `coord`: the pane grows when the pointer moves this way. */
  sign: 1 | -1;
}

/**
 * The axis-dependent half of a resize handle: which pointer coordinate to read,
 * which way the pane grows, and how the separator presents itself.
 *
 * Kept pure so the vertical case is testable without a DOM, and so the axis and
 * the growth direction cannot be paired into a silently inverted drag.
 */
export function getPanelAxisBehavior(
  axis: PanelAxis,
  growthDirection: PanelGrowthDirection,
): PanelAxisBehavior {
  // Only "right" and "down" move positively along their axis.
  const positive = growthDirection === "right" || growthDirection === "down";
  const sign = positive ? 1 : -1;
  if (axis === "y") {
    return {
      bodyCursor: "row-resize",
      coord: "clientY",
      growKey: positive ? "ArrowDown" : "ArrowUp",
      separatorOrientation: "horizontal",
      shrinkKey: positive ? "ArrowUp" : "ArrowDown",
      sign,
    };
  }
  return {
    bodyCursor: "col-resize",
    coord: "clientX",
    growKey: positive ? "ArrowRight" : "ArrowLeft",
    separatorOrientation: "vertical",
    shrinkKey: positive ? "ArrowLeft" : "ArrowRight",
    sign,
  };
}

export function getDefaultRightPanelWidth(viewportWidth: number): number {
  return clampPanelWidth(viewportWidth * 0.42, 360, 640);
}

export function getSidebarMaxWidth(options: {
  viewportWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
}): number {
  const { viewportWidth, rightPanelOpen, rightPanelWidth } = options;
  if (viewportWidth <= MOBILE_MAX_WIDTH) return SIDEBAR_MAX_WIDTH;

  const compact = viewportWidth < SPLIT_PANEL_MIN_WIDTH;
  const chatWidth = compact ? COMPACT_CHAT_MIN_WIDTH : DESKTOP_CHAT_MIN_WIDTH;
  const visibleRightPanelWidth = !compact && rightPanelOpen ? rightPanelWidth : 0;
  return Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - chatWidth - visibleRightPanelWidth);
}

export function getRightPanelMaxWidth(options: {
  viewportWidth: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
}): number {
  const { viewportWidth, sidebarOpen, sidebarWidth } = options;
  if (viewportWidth < SPLIT_PANEL_MIN_WIDTH) return RIGHT_PANEL_MAX_WIDTH;

  const visibleSidebarWidth = sidebarOpen ? sidebarWidth : 0;
  return Math.min(
    RIGHT_PANEL_MAX_WIDTH,
    viewportWidth - DESKTOP_CHAT_MIN_WIDTH - visibleSidebarWidth,
  );
}
