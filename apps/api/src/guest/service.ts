import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";
import { appBaseUrl } from "../verify/service.js";

/** Whether the order was placed through guest checkout. False (without a query) until the migration lands. */
export async function isGuestOrder(orderId: string): Promise<boolean> {
  if (!(await hasTable("guest_orders"))) return false;
  const res = await db.execute({ sql: "SELECT 1 FROM guest_orders WHERE order_id = ?", args: [orderId] });
  return res.rows.length > 0;
}

/** Where the payment provider sends a guest back: their order page, not the signed-in pay screen. */
export function guestReturnUrl(orderId: string): string {
  return `${appBaseUrl("customer")}/guest/order/${orderId}?payment_return=1`;
}

/** Digits and letters that cannot be misread over the phone (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newTrackingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `PB-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export function normalizeGuestPhone(value: string): string | null {
  let s = value.replace(/[\s().-]/g, "");
  if (/^0[37]\d{8}$/.test(s)) s = `+256${s.slice(1)}`;
  else if (/^256\d{9}$/.test(s)) s = `+${s}`;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

export function normalizeTrackingCode(value: string): string {
  const s = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.startsWith("PB") ? `PB-${s.slice(2)}` : value.trim().toUpperCase();
}
