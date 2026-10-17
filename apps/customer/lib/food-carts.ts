/**
 * Food (restaurant) carts on this device.
 *
 * Each restaurant's current cart lives in sessionStorage (`peebee-food-cart:{user|guest}:{restaurantId}`)
 * as `{ lines, updatedAt }`; the older plain-array format is still read, as `updatedAt: 0` (stale).
 *
 * A cart left longer than the admin's expiry (`marketplace.cartExpiryHours`) is never pulled into a new
 * checkout: it is set aside as an "earlier cart" in localStorage (`peebee-food-earlier-carts:{user|guest}`),
 * where it survives the session and can be restored from that restaurant's page.
 */
import { isCartStale } from "./cart";

export type StoredFoodCart<L> = { lines: L[]; updatedAt: number };

export type FoodEarlierCart<L> = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  /** When it was set aside. */
  savedAt: number;
  lines: L[];
  /** When it was last changed before being set aside (0 = unknown). */
  updatedAt?: number;
};

const EARLIER_PREFIX = "peebee-food-earlier-carts:";
const MAX_EARLIER = 10;
export const FOOD_EARLIER_EVENT = "peebee:food_earlier_change";

export function readFoodCart<L>(key: string, isLine: (v: unknown) => v is L): StoredFoodCart<L> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (Array.isArray(saved)) return { lines: saved.filter(isLine), updatedAt: 0 };
    if (saved && typeof saved === "object") {
      const row = saved as { lines?: unknown; updatedAt?: unknown };
      return { lines: Array.isArray(row.lines) ? row.lines.filter(isLine) : [], updatedAt: Number(row.updatedAt) || 0 };
    }
  } catch {}
  return { lines: [], updatedAt: 0 };
}

export function writeFoodCart<L>(key: string, lines: L[], updatedAt = Date.now()): void {
  try {
    if (lines.length === 0) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify({ lines, updatedAt }));
  } catch {}
}

export function removeFoodCart(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

export function isFoodCartFresh(cart: StoredFoodCart<unknown>, expiryHours: number): boolean {
  return cart.lines.length > 0 && !isCartStale(cart.updatedAt, Date.now(), expiryHours);
}

function isEarlier(value: unknown): value is FoodEarlierCart<unknown> {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FoodEarlierCart<unknown>>;
  return typeof row.id === "string" && typeof row.restaurantId === "string" && Array.isArray(row.lines);
}

export function loadFoodEarlierCarts<L>(owner: string, isLine: (v: unknown) => v is L): FoodEarlierCart<L>[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(EARLIER_PREFIX + owner) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(isEarlier)
      .map((row) => ({
        ...row,
        restaurantName: typeof row.restaurantName === "string" ? row.restaurantName : "",
        savedAt: Number(row.savedAt) || 0,
        lines: row.lines.filter(isLine),
      }))
      .filter((row) => row.lines.length > 0);
  } catch {
    return [];
  }
}

function writeFoodEarlierCarts(owner: string, rows: FoodEarlierCart<unknown>[]): void {
  try {
    const kept = [...rows].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_EARLIER);
    if (kept.length === 0) localStorage.removeItem(EARLIER_PREFIX + owner);
    else localStorage.setItem(EARLIER_PREFIX + owner, JSON.stringify(kept));
  } catch {}
  try {
    window.dispatchEvent(new Event(FOOD_EARLIER_EVENT));
  } catch {}
}

const anyLine = (v: unknown): v is unknown => v != null;

/** Sets a restaurant cart aside as an earlier cart (newest first, at most 10). Returns its id. */
export function setAsideFoodCart<L>(
  owner: string,
  restaurantId: string,
  restaurantName: string,
  cart: StoredFoodCart<L>,
): string | null {
  if (cart.lines.length === 0) return null;
  const id = `fec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: FoodEarlierCart<L> = { id, restaurantId, restaurantName, savedAt: Date.now(), lines: cart.lines, updatedAt: cart.updatedAt };
  writeFoodEarlierCarts(owner, [entry, ...loadFoodEarlierCarts(owner, anyLine)]);
  return id;
}

/** Fills in a restaurant name learned after the cart was set aside. */
export function nameFoodEarlierCarts(owner: string, restaurantId: string, restaurantName: string): void {
  const rows = loadFoodEarlierCarts(owner, anyLine);
  if (!rows.some((r) => r.restaurantId === restaurantId && !r.restaurantName)) return;
  writeFoodEarlierCarts(owner, rows.map((r) => (r.restaurantId === restaurantId && !r.restaurantName ? { ...r, restaurantName } : r)));
}

export function deleteFoodEarlierCart(owner: string, id: string): void {
  writeFoodEarlierCarts(owner, loadFoodEarlierCarts(owner, anyLine).filter((r) => r.id !== id));
}

export function foodEarlierCartDate(row: FoodEarlierCart<unknown>): number {
  return row.updatedAt && row.updatedAt > 0 ? row.updatedAt : row.savedAt;
}
