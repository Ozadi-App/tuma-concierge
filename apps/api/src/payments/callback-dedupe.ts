/**
 * Replay / idempotency protection for payment provider callbacks.
 *
 * Providers retry webhooks and attackers can replay captured ones. Each
 * callback is reduced to a stable event key (provider transaction id + the
 * status it reports) and claimed in `payment_callback_events` with
 * INSERT OR IGNORE. A second delivery of the same event is acknowledged
 * without re-processing. If processing fails, the claim is released so the
 * provider's retry can be handled.
 */
import { db } from "../db/client.js";

export type CallbackProvider = "yo" | "flutterwave";

type Exec = (stmt: { sql: string; args: (string | number)[] }) => Promise<{ rowsAffected?: number }>;

function pick(body: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/** Stable key for a callback, or "" when the payload carries no transaction id. */
export function callbackEventKey(provider: CallbackProvider, body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  if (provider === "flutterwave") {
    const data = (b.data && typeof b.data === "object" ? b.data : {}) as Record<string, unknown>;
    const id = pick(data, ["id", "flw_ref", "tx_ref"]);
    if (!id) return "";
    return `${id}:${pick(data, ["status"]).toLowerCase() || "-"}`;
  }
  const id = pick(b, ["NetworkRef", "network_ref", "TransactionReference", "transaction_reference", "ExternalReference", "external_reference"]);
  if (!id) return "";
  return `${id}:${pick(b, ["TransactionStatus", "transaction_status", "Status", "status"]).toLowerCase() || "-"}`;
}

const defaultExec: Exec = (stmt) => db.execute(stmt);

/** Returns "new" (process it), "duplicate" (already processed), or "unavailable" (table missing; fail open). */
export async function claimCallbackEvent(
  provider: CallbackProvider,
  eventKey: string,
  reference: string,
  exec: Exec = defaultExec,
): Promise<"new" | "duplicate" | "unavailable"> {
  try {
    const res = await exec({
      sql: "INSERT OR IGNORE INTO payment_callback_events (provider, event_key, reference) VALUES (?, ?, ?)",
      args: [provider, eventKey, reference],
    });
    return (res.rowsAffected ?? 0) > 0 ? "new" : "duplicate";
  } catch (err) {
    console.warn("payment_callback_events unavailable; callback dedupe skipped:", err);
    return "unavailable";
  }
}

export async function releaseCallbackEvent(provider: CallbackProvider, eventKey: string, exec: Exec = defaultExec): Promise<void> {
  try {
    await exec({ sql: "DELETE FROM payment_callback_events WHERE provider = ? AND event_key = ?", args: [provider, eventKey] });
  } catch {
    /* best effort */
  }
}
