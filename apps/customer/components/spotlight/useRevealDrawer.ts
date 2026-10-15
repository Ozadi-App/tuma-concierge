"use client";

import { useCallback, useRef, useState } from "react";

/** Drives the cover-show drawer: returns the progress (0 closed .. 1 open)
 * plus pointer handlers for horizontal swipe/drag. Vertical gestures are left
 * alone so the feed keeps scrolling. */
export function useRevealDrawer(open: boolean, setOpen: (open: boolean) => void, enabled = true) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; w: number; mode: "pending" | "drag" | "scroll" } | null>(null);
  const suppressClick = useRef(false);
  const dragRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    if (target.closest("input,textarea,[data-no-drag]")) return;
    start.current = { x: e.clientX, y: e.clientY, w: e.currentTarget.getBoundingClientRect().width, mode: "pending" };
  }, [enabled]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === "pending") {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        // Only start in the direction that makes sense for the current state.
        if ((!open && dx > 0) || (open && dx < 0)) { s.mode = "scroll"; return; }
        s.mode = "drag";
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(dy) > 10) {
        s.mode = "scroll";
        return;
      } else return;
    }
    if (s.mode !== "drag") return;
    const base = open ? 1 : 0;
    const p = Math.min(1, Math.max(0, base - dx / (s.w * 0.9)));
    dragRef.current = p;
    setDrag(p);
  }, [open]);

  const end = useCallback(() => {
    const s = start.current;
    start.current = null;
    if (!s || s.mode !== "drag") return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    const p = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (p != null) setOpen(open ? p > 0.7 : p > 0.3);
  }, [open, setOpen]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); }
  }, []);

  return {
    progress: drag ?? (open ? 1 : 0),
    dragging: drag != null,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture },
  };
}
