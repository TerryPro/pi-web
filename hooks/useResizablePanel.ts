"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import { clampPanelWidth } from "@/lib/panel-layout";

interface DragState {
  pointerId: number;
  startCoord: number;
  startSize: number;
  target: HTMLDivElement;
  previousCursor: string;
  previousUserSelect: string;
}

interface UseResizablePanelOptions {
  ariaLabel: string;
  /** Axis the panel grows along. Defaults to the horizontal ("x") case. */
  axis?: "x" | "y";
  cssVariable: `--${string}`;
  defaultSize: number;
  getDefaultSize?: () => number;
  /** Live upper bound, re-read on every commit/resize (e.g. measured from the DOM). */
  getMaxSize: () => number;
  /** Direction the panel grows when the pointer moves positively along the axis. */
  growthDirection: "left" | "right" | "up" | "down";
  maxSize: number;
  minSize: number;
  storageKey: string;
  sizeRef: MutableRefObject<number>;
}

interface CommitOptions {
  forcePersist?: boolean;
  persist?: boolean;
}

function readStoredSize(storageKey: string): number | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return null;
    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSize(storageKey: string, size: number): void {
  try {
    window.localStorage.setItem(storageKey, String(size));
  } catch {
    // Resizing remains available when storage is unavailable.
  }
}

export function useResizablePanel(options: UseResizablePanelOptions) {
  const {
    ariaLabel,
    axis = "x",
    cssVariable,
    defaultSize,
    getDefaultSize,
    getMaxSize,
    growthDirection,
    maxSize,
    minSize,
    storageKey,
    sizeRef,
  } = options;
  const isVertical = axis === "y";
  // A "left"/"up" panel grows as the pointer moves negatively along the axis;
  // "right"/"down" grows as it moves positively.
  const growthSign = growthDirection === "right" || growthDirection === "down" ? 1 : -1;
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const restoredRef = useRef(false);
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const effectiveMaxSize = useCallback(
    () => Math.min(maxSize, Math.max(minSize, getMaxSize())),
    [getMaxSize, maxSize, minSize],
  );

  const clampSize = useCallback(
    (candidate: number) => clampPanelWidth(candidate, minSize, effectiveMaxSize()),
    [effectiveMaxSize, minSize],
  );

  // During a drag the size is written straight to the DOM so the rest of the
  // tree is not re-rendered per pointermove; React state only catches up on commit.
  const applyLiveSize = useCallback((nextSize: number) => {
    sizeRef.current = nextSize;
    panelRef.current?.style.setProperty(cssVariable, `${nextSize}px`);
  }, [cssVariable, sizeRef]);

  const commitSize = useCallback((candidate: number, commitOptions: CommitOptions = {}) => {
    const { forcePersist = false, persist = true } = commitOptions;
    const nextSize = clampSize(candidate);
    const changed = nextSize !== sizeRef.current;
    applyLiveSize(nextSize);
    setSize(nextSize);
    if (persist && (changed || forcePersist)) writeStoredSize(storageKey, nextSize);
    return nextSize;
  }, [applyLiveSize, clampSize, sizeRef, storageKey]);

  const restoreBodyState = useCallback((drag: DragState) => {
    document.body.style.cursor = drag.previousCursor;
    document.body.style.userSelect = drag.previousUserSelect;
  }, []);

  const finishResize = useCallback((pointerId: number) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    dragRef.current = null;
    restoreBodyState(drag);
    setIsResizing(false);
    commitSize(sizeRef.current, { forcePersist: true });

    try {
      if (drag.target.hasPointerCapture(pointerId)) {
        drag.target.releasePointerCapture(pointerId);
      }
    } catch {
      // The browser may have already released capture after pointer cancellation.
    }
  }, [commitSize, restoreBodyState, sizeRef]);

  const pointerCoord = useCallback(
    (event: PointerEvent<HTMLDivElement>) => (isVertical ? event.clientY : event.clientX),
    [isVertical],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const activeDrag = dragRef.current;
    if (activeDrag) finishResize(activeDrag.pointerId);

    const target = event.currentTarget;
    target.focus({ preventScroll: true });
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startCoord: pointerCoord(event),
      startSize: sizeRef.current,
      target,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    setIsResizing(true);
  }, [finishResize, isVertical, pointerCoord, sizeRef]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
      finishResize(event.pointerId);
      return;
    }
    event.preventDefault();

    const nextSize = clampSize(drag.startSize + ((pointerCoord(event) - drag.startCoord) * growthSign));
    applyLiveSize(nextSize);
    event.currentTarget.setAttribute("aria-valuenow", String(nextSize));
    event.currentTarget.setAttribute("aria-valuetext", `${nextSize} px`);
  }, [applyLiveSize, clampSize, finishResize, growthSign, pointerCoord]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    finishResize(event.pointerId);
  }, [finishResize]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    finishResize(event.pointerId);
  }, [finishResize]);

  const onLostPointerCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    finishResize(event.pointerId);
  }, [finishResize]);

  const resetSize = useCallback(() => {
    const nextDefault = getDefaultSize?.() ?? defaultSize;
    commitSize(nextDefault, { forcePersist: true });
  }, [commitSize, defaultSize, getDefaultSize]);

  const reclampSize = useCallback(() => {
    commitSize(sizeRef.current);
  }, [commitSize, sizeRef]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 12;
    const positive = growthSign > 0;
    const growKey = isVertical
      ? (positive ? "ArrowDown" : "ArrowUp")
      : (positive ? "ArrowRight" : "ArrowLeft");
    const shrinkKey = isVertical
      ? (positive ? "ArrowUp" : "ArrowDown")
      : (positive ? "ArrowLeft" : "ArrowRight");

    if (event.key === growKey) {
      event.preventDefault();
      commitSize(sizeRef.current + step, { forcePersist: true });
    } else if (event.key === shrinkKey) {
      event.preventDefault();
      commitSize(sizeRef.current - step, { forcePersist: true });
    } else if (event.key === "Home") {
      event.preventDefault();
      commitSize(minSize, { forcePersist: true });
    } else if (event.key === "End") {
      event.preventDefault();
      commitSize(effectiveMaxSize(), { forcePersist: true });
    } else if (event.key === "Enter") {
      event.preventDefault();
      resetSize();
    }
  }, [commitSize, effectiveMaxSize, growthSign, isVertical, minSize, resetSize, sizeRef]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const storedSize = readStoredSize(storageKey);
    const candidate = storedSize ?? getDefaultSize?.() ?? defaultSize;
    const restoredSize = commitSize(candidate, { persist: false });
    if (storedSize !== null && storedSize !== restoredSize) {
      writeStoredSize(storageKey, restoredSize);
    }
  }, [commitSize, defaultSize, getDefaultSize, storageKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    commitSize(sizeRef.current);

    const onResize = () => {
      commitSize(sizeRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [commitSize, sizeRef]);

  useEffect(() => {
    if (!isResizing) return;
    const cancelResize = () => {
      const drag = dragRef.current;
      if (drag) finishResize(drag.pointerId);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") cancelResize();
    };
    window.addEventListener("blur", cancelResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", cancelResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [finishResize, isResizing]);

  useEffect(() => {
    return () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      restoreBodyState(drag);
    };
  }, [restoreBodyState]);

  return {
    isResizing,
    panelRef,
    reclampSize,
    resetSize,
    separatorProps: {
      "aria-label": ariaLabel,
      "aria-orientation": (isVertical ? "horizontal" : "vertical") as "horizontal" | "vertical",
      "aria-valuemax": mounted ? effectiveMaxSize() : maxSize,
      "aria-valuemin": minSize,
      "aria-valuenow": size,
      "aria-valuetext": `${size} px`,
      onDoubleClick: resetSize,
      onKeyDown,
      onLostPointerCapture,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      role: "separator" as const,
      tabIndex: 0,
    },
    size,
  };
}
