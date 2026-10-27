import { type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/**
 * The Money cluster: wallet history for customers and riders (top-ups, a withdrawal, a transfer), rider Pro and weekly
 * subscriptions, cash the riders owe, and a second wallet shared between two customers. Reading a list aloud in Luganda
 * is attached to a real practice order afterwards (see attachLugandaAudio).
 */
const when = (offset: string) => `datetime('now', '${offset}')`;

export async function seedMoney(): Promise<void> {
  const s: DbStatement[] = [];
  PRACTICE_CUSTOMERS.slice(0, 4).forEach((c, i) => {
    const opening = c.walletUgx;
    s.push({ sql: "INSERT OR IGNORE INTO wallet_topups (id, user_id, amount, provider, provider_ref, method, msisdn, network, status, environment, created_at) VALUES (?, ?, ?, 'mock', ?, 'mobile_money', ?, ?, 'successful', 'sandbox', " + when(`-${8 + i} days`) + ")", args: [`prac_tu_${i}`, c.id, opening, `PRAC-TOPUP-${i}`, c.phone, i % 2 ? "airtel" : "mtn"] });
    s.push({ sql: "INSERT OR IGNORE INTO wallet_ledger (id, user_id, type, amount, balance_after, topup_id, note, environment, created_at) VALUES (?, ?, 'topup', ?, ?, ?, 'Mobile money top-up', 'sandbox', " + when(`-${8 + i} days`) + ")", args: [`prac_wl_${i}_1`, c.id, opening, opening, `prac_tu_${i}`] });
    s.push({ sql: "INSERT OR IGNORE INTO wallet_topups (id, user_id, amount, provider, provider_ref, method, msisdn, network, status, environment, created_at) VALUES (?, ?, 20000, 'mock', ?, 'mobile_money', ?, 'mtn', 'failed', 'sandbox', " + when("-2 days") + ")", args: [`prac_tu_f${i}`, c.id, `PRAC-TOPUP-F${i}`, c.phone] });
  });
  s.push({ sql: "INSERT OR IGNORE INTO wallet_ledger (id, user_id, type, amount, balance_after, counterparty_id, note, environment, created_at) VALUES ('prac_wl_t1', 'prac_cust_amina', 'transfer_out', -30000, 220000, 'prac_cust_brian', 'Share of the taxi fare', 'sandbox', " + when("-3 days") + ")", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO wallet_ledger (id, user_id, type, amount, balance_after, counterparty_id, note, environment, created_at) VALUES ('prac_wl_t2', 'prac_cust_brian', 'transfer_in', 30000, 210000, 'prac_cust_amina', 'Share of the taxi fare', 'sandbox', " + when("-3 days") + ")", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO wallets (id, owner_id, name, balance, balance_sandbox) VALUES ('prac_wallet_family', 'prac_cust_amina', 'Family wallet', 0, 80000)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO wallet_shares (id, owner_id, grantee_id, status, wallet_id) VALUES ('prac_ws_1', 'prac_cust_amina', 'prac_cust_grace', 'active', 'prac_wallet_family')", args: [] });

  // Riders: top-ups, a withdrawal to mobile money, weekly subscription, Pro (recurring for one, once for another), cash owed.
  for (const n of [1, 2, 3]) {
    s.push({ sql: "INSERT OR IGNORE INTO rider_wallet_topups (id, rider_id, amount, provider, provider_ref, msisdn, network, status, environment) VALUES (?, ?, 50000, 'mock', ?, ?, 'mtn', 'successful', 'sandbox')", args: [`prac_rtu_${n}`, `prac_rider_${n}`, `PRAC-RTOPUP-${n}`, `00000002${String(n).padStart(2, "0")}`] });
  }
  s.push({ sql: "INSERT OR IGNORE INTO wallet_withdrawals (id, rider_id, amount, provider, provider_ref, msisdn, network, status, environment) VALUES ('prac_rw_1', 'prac_rider_1', 40000, 'mock', 'PRAC-WD-1', '0000000201', 'mtn', 'successful', 'sandbox')", args: [] });
  for (const [n, mode] of [[1, "recurring"], [2, "once"]] as const) {
    s.push({ sql: "INSERT OR IGNORE INTO rider_pro_subscription_payments (id, rider_id, mode, amount, provider, provider_ref, msisdn, status, period_start, period_end, environment) VALUES (?, ?, ?, 15000, 'mock', ?, ?, 'successful', " + when("-10 days") + ", " + when("+20 days") + ", 'sandbox')", args: [`prac_rpp_${n}`, `prac_rider_${n}`, mode, `PRAC-PRO-${n}`, `00000002${String(n).padStart(2, "0")}`] });
    s.push({ sql: "UPDATE riders SET pro_status = 'active', pro_mode = ?, pro_paid_through = " + when("+20 days") + " WHERE user_id = ?", args: [mode, `prac_rider_${n}`] });
  }
  s.push({ sql: "INSERT OR IGNORE INTO rider_subscription_payments (id, rider_id, mode, amount, provider, provider_ref, msisdn, status, period_start, period_end, environment) VALUES ('prac_rsp_1', 'prac_rider_3', 'recurring', 5000, 'mock', 'PRAC-SUB-3', '0000000203', 'successful', " + when("-2 days") + ", " + when("+5 days") + ", 'sandbox')", args: [] });
  s.push({ sql: "UPDATE riders SET subscription_status = 'active', subscription_paid_through = " + when("+5 days") + " WHERE user_id = 'prac_rider_3'", args: [] });
  await runSeed(s);
}

/** Gives one practice shopping list a Luganda reading (a short audio file) so the "listen in Luganda" button has something to play. */
export async function attachLugandaAudio(): Promise<void> {
  const { db } = await import("../db/client.js");
  const { getR2Bucket } = await import("../storage/r2.js");
  const order = (await db.execute("SELECT id FROM orders WHERE type = 'shopping' AND restaurant_id IS NULL AND customer_id LIKE 'prac\\_%' ESCAPE '\\' AND list_audio_key IS NULL ORDER BY created_at LIMIT 1")).rows[0];
  if (!order) return;
  const key = `list-audio/practice/${String(order.id)}.wav`;
  try {
    // A quarter second of silence: a valid WAV, so players accept it.
    const rate = 8_000, samples = 2_000, data = new Uint8Array(44 + samples);
    const view = new DataView(data.buffer);
    const text = (at: number, value: string) => [...value].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + samples, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); text(36, "data"); view.setUint32(40, samples, true);
    data.fill(128, 44);
    await getR2Bucket().put(key, data, { httpMetadata: { contentType: "audio/wav" } });
  } catch { /* no file store here: the order is still marked, the audio appears once one is bound */ }
  await db.execute({ sql: "UPDATE orders SET list_audio_voice = 'luganda_female', list_audio_key = ?, list_audio_text_hash = 'practice' WHERE id = ?", args: [key, String(order.id)] });
}
