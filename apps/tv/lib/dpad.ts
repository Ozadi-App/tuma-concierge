"use client";

import { useEffect } from "react";

/** Remote-control "back" across TV platforms: Android TV, Tizen (10009), webOS (461), plus Escape and Backspace. */
export function isBackKey(event: KeyboardEvent): boolean {
  return event.key === "Escape" || event.key === "Backspace" || event.key === "GoBack" || event.keyCode === 10009 || event.keyCode === 461 || event.keyCode === 4;
}

type Direction = "left" | "right" | "up" | "down";

const KEY_TO_DIRECTION: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

function visibleFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-focusable]")).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !el.hasAttribute("disabled");
  });
}

/**
 * Spatial navigation: the arrow keys move focus to the nearest focusable thing in that direction,
 * the way every TV launcher behaves. Enter ("OK") presses the focused button natively.
 */
export function pickNext(from: DOMRect, candidates: { el: HTMLElement; rect: DOMRect }[], dir: Direction): HTMLElement | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: { el: HTMLElement; score: number } | null = null;
  for (const { el, rect } of candidates) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    if (along <= 1) continue;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Things lined up with where you are beat things that are merely nearby.
    const score = along + across * 2.2;
    if (!best || score < best.score) best = { el, score };
  }
  return best?.el ?? null;
}

export function useDpad(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[event.key];
      if (!dir) return;
      const items = visibleFocusables();
      if (items.length === 0) return;
      event.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      if (!active || !items.includes(active)) {
        items[0].focus();
        return;
      }
      const from = active.getBoundingClientRect();
      const next = pickNext(from, items.filter((el) => el !== active).map((el) => ({ el, rect: el.getBoundingClientRect() })), dir);
      if (next) next.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Runs `handler` when the remote's Back button is pressed. */
export function useBack(handler: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isBackKey(event)) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
