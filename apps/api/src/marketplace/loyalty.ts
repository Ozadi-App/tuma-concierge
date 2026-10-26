import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getOption } from "../lib/option-settings.js";
import { hasTable } from "../lib/schema.js";

type Row = Record<string, unknown>;

type Credit = { storeId: string; phone: string; name: string | null; earnedUgx: number; spentUgx: number };

/** The loyalty ledger row for a customer at a store: balance, order count and tier. */
async function creditCustomer(c: Credit): Promise<void> {
  await db.execute({
    sql: `INSERT INTO store_customer_loyalty (
            id, store_id, customer_phone, customer_name, points_balance_ugx,
            total_earned_ugx, total_redeemed_ugx, orders_count, total_spent_ugx,
            tier, last_order_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(store_id, customer_phone) DO UPDATE SET
            customer_name = COALESCE(excluded.customer_name, store_customer_loyalty.customer_name),
            points_balance_ugx = store_customer_loyalty.points_balance_ugx + excluded.points_balance_ugx,
            total_earned_ugx = store_customer_loyalty.total_earned_ugx + excluded.total_earned_ugx,
            orders_count = store_customer_loyalty.orders_count + 1,
            total_spent_ugx = store_customer_loyalty.total_spent_ugx + excluded.total_spent_ugx,
            tier = CASE
              WHEN store_customer_loyalty.tier = 'b2b' THEN 'b2b'
              WHEN (store_customer_loyalty.total_spent_ugx + excluded.total_spent_ugx) >= 200000 OR (store_customer_loyalty.orders_count + 1) >= 5 THEN 'vip'
              WHEN (store_customer_loyalty.orders_count + 1) >= 2 THEN 'repeat'
              ELSE 'standard'
            END,
            last_order_at = datetime('now')`,
    args: [newId("crm"), c.storeId, c.phone, c.name, c.earnedUgx, c.earnedUgx, c.spentUgx, c.spentUgx >= 200000 ? "vip" : "standard"],
  });
}

/**
 * Called when an order is placed. Admin option `loyalty_credit_trigger` decides when the cashback is actually
 * credited: at once (the old behaviour), once payment is confirmed, or once the order is delivered and settled.
 * Until then it waits as a pending event, so a cancelled or unpaid order never earns anything.
 */
export async function recordLoyaltyForOrder(input: Credit & { orderId: string }): Promise<void> {
  if (!(await hasTable("store_customer_loyalty"))) return;
  const trigger = await getOption<string>("loyalty_credit_trigger");
  if (trigger === "on_order_placed" || !(await hasTable("store_loyalty_events"))) {
    await creditCustomer(input);
    return;
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO store_loyalty_events (id, store_id, order_id, customer_phone, customer_name, earned_ugx, spent_ugx)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [newId("loy"), input.storeId, input.orderId, input.phone, input.name, input.earnedUgx, input.spentUgx],
  });
}

const PRE_PAYMENT = new Set(["Create", "Match", "Fund"]);

/**
 * Credit every pending event whose moment has come, void those whose order was cancelled. Safe to call often and from
 * several places at once: each event is claimed with a conditional update, so it is credited exactly once.
 * Pass an order id to look at just that order (the settle hook); otherwise it sweeps recent pending events.
 */
export async function settleLoyalty(orderId?: string): Promise<number> {
  if (!(await hasTable("store_loyalty_events"))) return 0;
  const trigger = await getOption<string>("loyalty_credit_trigger");
  if (trigger === "on_order_placed") return 0;

  const res = await db.execute({
    sql: `SELECT e.*, o.stage AS order_stage, o.payment_rail AS order_rail
          FROM store_loyalty_events e JOIN orders o ON o.id = e.order_id
          WHERE e.status = 'pending' ${orderId ? "AND e.order_id = ?" : ""}
          ORDER BY e.created_at LIMIT 200`,
    args: orderId ? [orderId] : [],
  });

  let credited = 0;
  for (const e of res.rows as Row[]) {
    const stage = String(e.order_stage);
    let decision: "credit" | "void" | "wait" = "wait";
    if (stage === "Cancelled") decision = "void";
    else if (stage === "Settle") decision = "credit";
    else if (trigger === "on_payment_confirmed" && !PRE_PAYMENT.has(stage) && String(e.order_rail) === "escrow") decision = "credit";
    if (decision === "wait") continue;

    const claim = await db.execute({
      sql: `UPDATE store_loyalty_events SET status = ?, credited_at = datetime('now') WHERE id = ? AND status = 'pending'`,
      args: [decision === "credit" ? "credited" : "void", String(e.id)],
    });
    if (!claim.rowsAffected || decision === "void") continue;
    await creditCustomer({
      storeId: String(e.store_id),
      phone: String(e.customer_phone),
      name: e.customer_name ? String(e.customer_name) : null,
      earnedUgx: Number(e.earned_ugx) || 0,
      spentUgx: Number(e.spent_ugx) || 0,
    });
    credited++;
  }
  return credited;
}
