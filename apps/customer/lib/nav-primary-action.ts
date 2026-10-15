"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A page can hand the bottom nav one primary action (e.g. /cart → "Checkout").
 * The nav then swaps its right-hand capsule for a single button that runs it,
 * so the page doesn't need its own floating bar on top of the nav.
 */
export interface NavPrimaryAction {
  /** "gold" = final action (Checkout); "cart" = open/review a cart (white in light, grey in dark). */
  tone?: "gold" | "cart";
  /** Item count badge for tone "cart". */
  count?: number;
  /** Small line under the label for tone "cart", e.g. "2 items". */
  sublabel?: string;
  label: string;
  /** Secondary text shown on the button, e.g. the order total. */
  detail?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}

let current: NavPrimaryAction | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNavPrimaryAction(): NavPrimaryAction | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Registers the action while the calling component is mounted (pass null to clear). */
export function useRegisterNavPrimaryAction(action: Omit<NavPrimaryAction, "onClick"> & { onClick: () => void } | null) {
  // Keep the latest handler without re-registering on every render.
  const handlerRef = useRef<(() => void) | null>(null);
  handlerRef.current = action?.onClick ?? null;
  const label = action?.label;
  const tone = action?.tone;
  const count = action?.count;
  const sublabel = action?.sublabel;
  const detail = action?.detail;
  const disabled = action?.disabled;
  const busy = action?.busy;
  const enabled = action !== null;

  useEffect(() => {
    if (!enabled || label === undefined) {
      return;
    }
    const entry: NavPrimaryAction = {
      tone,
      count,
      sublabel,
      label,
      detail,
      disabled,
      busy,
      onClick: () => handlerRef.current?.(),
    };
    current = entry;
    emit();
    return () => {
      if (current === entry) {
        current = null;
        emit();
      }
    };
  }, [enabled, tone, count, sublabel, label, detail, disabled, busy]);
}
