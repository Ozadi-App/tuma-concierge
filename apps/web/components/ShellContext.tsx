"use client";

import { createContext, useContext, type RefObject } from "react";
import type { DoorId } from "../lib/doors";

export type ShellApi = {
  scroller: RefObject<HTMLElement | null>;
  /** The door whose drawer is open (the URL is /buy, /work, …). */
  activeDoor: DoorId | null;
  /** The door the current page belongs to, drawer open or not: /buy/stores belongs to Buy. */
  contextDoor: DoorId | null;
  /** Close any drawer and return to the home screen. */
  goHome: () => void;
  /** Open a door drawer; `section` scrolls the drawer to one of its sub-features (Spotlight sits in Buy). */
  openDoor: (id: DoorId, section?: string) => void;
  /** The sub-feature a drawer should be focused on, with a counter so asking twice scrolls twice. */
  focus: { id: DoorId; section: string; n: number } | null;
  closeDoor: () => void;
  /** Open a feature pop-up (Wallet, Parcels, Chat…) by id, e.g. "acct/wallet" or "buy/substitutes". */
  openFeature: (id: string) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
};

export const ShellContext = createContext<ShellApi | null>(null);
export function useShell() {
  const v = useContext(ShellContext);
  if (!v) throw new Error("useShell outside Shell");
  return v;
}
