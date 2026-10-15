"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A page or flow can hand the bottom nav one primary action (e.g. /cart →
 * "Checkout", a ride sheet → "Next: payment"). The nav then swaps its
 * right-hand capsule for a single button that runs it, so the screen doesn't
 * need its own floating/in-sheet primary button above the nav.
 *
 * Several components can register at once (a restaurant page and the place
 * picker it opens, or a ride sheet and its "where to?" step). The one that
 * became active most recently wins; when it clears, the previous one returns.
 */
export interface NavPrimaryAction {
  /**
   * "gold" = final / pay action (Checkout, Pay UGX X) — gold in both themes.
   * "step" = an intermediate step (Confirm destination, Next: payment) — white in light, grey in dark.
   * "cart" = open/review a cart (same colours as "step", with a bag + count).
   */
  tone?: "gold" | "step" | "cart";
  /** Item count badge for tone "cart". */
  count?: number;
  /** Small line under the label, e.g. "2 items". */
  sublabel?: string;
  label: string;
  /** Secondary text shown on the button, e.g. the order total. */
  detail?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}

type Slot = { action: NavPrimaryAction | null; seq: number; priority: number };

const slots = new Map<number, Slot>();
let nextId = 1;
let nextSeq = 1;
let current: NavPrimaryAction | null = null;
const listeners = new Set<() => void>();

function recompute() {
  let best: Slot | null = null;
  for (const slot of slots.values()) {
    if (slot.action && (!best || slot.priority > best.priority || (slot.priority === best.priority && slot.seq > best.seq))) best = slot;
  }
  const next = best?.action ?? null;
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNavPrimaryAction(): NavPrimaryAction | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/**
 * Registers the action while the calling component is mounted (pass null to clear).
 * `priority` lets a full-screen overlay (the place picker) win over the page
 * underneath even when both become active in the same render.
 */
export function useRegisterNavPrimaryAction(action: NavPrimaryAction | null, priority = 0) {
  // Keep the latest handler without re-registering on every render.
  const handlerRef = useRef<(() => void) | null>(null);
  handlerRef.current = action?.onClick ?? null;
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = nextId++;
  const label = action?.label;
  const tone = action?.tone;
  const count = action?.count;
  const sublabel = action?.sublabel;
  const detail = action?.detail;
  const disabled = action?.disabled;
  const busy = action?.busy;
  const enabled = action !== null;

  // Remove this component's slot when it unmounts.
  useEffect(() => {
    const id = idRef.current!;
    return () => {
      slots.delete(id);
      recompute();
    };
  }, []);

  useEffect(() => {
    const id = idRef.current!;
    const prev = slots.get(id);
    if (!enabled || label === undefined) {
      slots.set(id, { action: null, seq: prev?.seq ?? 0, priority });
      recompute();
      return;
    }
    // Becoming active (from nothing) moves this flow to the top; plain
    // updates (label, disabled, total…) keep its place.
    const seq = prev?.action ? prev.seq : nextSeq++;
    slots.set(id, {
      seq,
      priority,
      action: { tone, count, sublabel, label, detail, disabled, busy, onClick: () => handlerRef.current?.() },
    });
    recompute();
  }, [enabled, tone, count, sublabel, label, detail, disabled, busy, priority]);
}
