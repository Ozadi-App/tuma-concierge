"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside `ref` while `active`, moves focus in on open, and gives it back on close. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, initial?: string) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const prev = document.activeElement as HTMLElement | null;
    const list = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
    // wait a frame: the drawer is still becoming visible when this runs
    const raf = requestAnimationFrame(() => {
      const first = (initial && el.querySelector<HTMLElement>(initial)) || list()[0];
      first?.focus({ preventScroll: true });
    });
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      // a feature pop-up on top keeps its own focus
      if (!el!.closest(".fs") && document.querySelector(".fs[data-open]")) return;
      const items = list();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const cur = document.activeElement;
      if (!el!.contains(cur)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && cur === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [ref, active, initial]);
}
