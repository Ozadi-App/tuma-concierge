"use client";

import type { TaxipressAssistance, TaxipressLanguage, TaxipressLuggageType } from "@peebee/shared";

/** A TaxiPress booking being put together across steps 2 and 3, kept for this tab only. */
export type TaxipressDraft = {
  routeId: string;
  queueId: string;
  adults: number;
  children: number;
  forSomeoneElse: boolean;
  travellerName: string;
  travellerPhone: string;
  emergencyPhone: string;
  luggage: Partial<Record<TaxipressLuggageType, number>>;
  assistance: TaxipressAssistance;
  language: TaxipressLanguage | null;
};

const KEY = "peebee.taxipress.draft";

export function emptyDraft(routeId: string, queueId = ""): TaxipressDraft {
  return { routeId, queueId, adults: 1, children: 0, forSomeoneElse: false, travellerName: "", travellerPhone: "", emergencyPhone: "", luggage: {}, assistance: "none", language: null };
}

export function readDraft(routeId: string): TaxipressDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as TaxipressDraft | null;
    return d && d.routeId === routeId ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: TaxipressDraft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode: the flow still works on one screen */ }
}

export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Seats a party takes: adults, plus children beyond those who ride on a lap. */
export function seatsFor(adults: number, children: number, maxLap: number) {
  return adults + Math.max(0, children - maxLap);
}

/** Where the shared checkout returns to after paying for an order (read by /orders/[id]/pay). */
export const payReturnKey = (orderId: string) => `peebee.payReturn.${orderId}`;
export function setPayReturn(orderId: string, path: string) {
  try { sessionStorage.setItem(payReturnKey(orderId), path); } catch { /* falls back to the order page */ }
}

export const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit" });
export const minutesFromNow = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** The whole way, start to end, without repeating the end stages when the route's stops already list them. */
export function journey(fromName: string, stops: string[], toName: string): string[] {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return [fromName, ...stops.filter((s) => !same(s, fromName) && !same(s, toName)), toName];
}
