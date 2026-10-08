/**
 * Pointer/keyboard resizing for one element edge.
 *
 * During a drag the size is written straight to the element's inline style so
 * a 60fps drag never re-renders the surrounding tree; the committed value goes
 * into state (and localStorage) on pointer release.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clampPanelSize, loadPanelSize, savePanelSize, type PanelSizeConfig } from "../lib/panelLayout";

export type ResizeAxis = "x" | "y";
/** `end` = handle on the far edge (drag right/bottom grows); `start` = near edge. */
export type ResizeEdge = "start" | "end";

export interface ResizablePanelOptions extends PanelSizeConfig {
  storageKey: string;
  axis: ResizeAxis;
  edge: ResizeEdge;
  /** Ignore drags/keyboard while the panel is collapsed or on small screens. */
  disabled?: boolean;
  /** Keyboard step in px (defaults: 16 for a vertical handle, 12 for horizontal). */
  step?: number;
}

export interface ResizablePanelApi {
  size: number;
  dragging: boolean;
  elementRef: React.RefObject<HTMLElement | null>;
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
  };
  setSize: (size: number) => void;
  reset: () => void;
  /** Keyboard nudge (positive = grow). */
  nudge: (delta: number) => void;
}

export function useResizablePanel(options: ResizablePanelOptions): ResizablePanelApi {
  const { storageKey, min, max, defaultSize, axis, edge, disabled, step } = options;
  const elementRef = useRef<HTMLElement | null>(null);
  const [size, setSizeState] = useState<number>(() => loadPanelSize(options));
  const [dragging, setDragging] = useState(false);
  const liveSizeRef = useRef(size);
  const dragRef = useRef<{ pointer: number; size: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setSize = useCallback(
    (next: number) => {
      const clamped = clampPanelSize(next, { min, max, defaultSize });
      liveSizeRef.current = clamped;
      setSizeState(clamped);
      savePanelSize(storageKey, clamped);
    },
    [storageKey, min, max, defaultSize]
  );

  const reset = useCallback(() => {
    const element = elementRef.current;
    if (element) element.style[axis === "x" ? "width" : "height"] = "";
    liveSizeRef.current = defaultSize;
    setSizeState(defaultSize);
    savePanelSize(storageKey, defaultSize);
  }, [axis, defaultSize, storageKey]);

  const nudge = useCallback(
    (delta: number) => {
      setSize(liveSizeRef.current + delta);
    },
    [setSize]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      const element = elementRef.current;
      if (!element || event.button !== 0) return;
      event.preventDefault();

      const rect = element.getBoundingClientRect();
      const startSize = axis === "x" ? rect.width : rect.height;
      if (startSize <= 0) return; // collapsed: nothing to drag from

      dragRef.current = { pointer: axis === "x" ? event.clientX : event.clientY, size: startSize };
      liveSizeRef.current = Math.round(startSize);
      setDragging(true);

      const onMove = (move: PointerEvent) => {
        const start = dragRef.current;
        if (!start) return;
        const raw = (axis === "x" ? move.clientX : move.clientY) - start.pointer;
        const next = clampPanelSize(start.size + (edge === "end" ? raw : -raw), { min, max, defaultSize });
        liveSizeRef.current = next;
        element.style[axis === "x" ? "width" : "height"] = `${next}px`;
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        dragRef.current = null;
        cleanupRef.current = null;
        setDragging(false);
        setSize(liveSizeRef.current);
      };

      const onKey = (key: KeyboardEvent) => {
        if (key.key === "Escape") finish();
      };

      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      window.addEventListener("keydown", onKey);
      cleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        window.removeEventListener("keydown", onKey);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    },
    [axis, defaultSize, disabled, edge, max, min, setSize]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const amount = step ?? (axis === "x" ? 16 : 12);
      const grow = axis === "x" ? (edge === "end" ? "ArrowRight" : "ArrowLeft") : edge === "end" ? "ArrowDown" : "ArrowUp";
      const shrink = axis === "x" ? (edge === "end" ? "ArrowLeft" : "ArrowRight") : edge === "end" ? "ArrowUp" : "ArrowDown";
      if (event.key === grow) {
        event.preventDefault();
        nudge(amount);
      } else if (event.key === shrink) {
        event.preventDefault();
        nudge(-amount);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reset();
      }
    },
    [axis, disabled, edge, nudge, reset, step]
  );

  const onDoubleClick = useCallback(() => {
    if (disabled) return;
    reset();
  }, [disabled, reset]);

  return {
    size,
    dragging,
    elementRef,
    handleProps: { onPointerDown, onKeyDown, onDoubleClick },
    setSize,
    reset,
    nudge,
  };
}
