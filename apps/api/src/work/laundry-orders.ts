import { db } from "../db/client.js";
import { cancelLaundry, conditionalTipReleased, settleLaundry } from "./laundry-pricing.js";
import { fromDb, type MoneyPlan, type Row } from "./service.js";

/** Every laundry order is booked under this service, so the engine can tell them apart without a query. */
export const LAUNDRY_SERVICE_ID = "wsv_laundry_order";
export const isLaundryJob = (job: Row) => job.service_id === LAUNDRY_SERVICE_ID;

export async function laundryOrderFor(jobId: string): Promise<Row | null> {
  return ((await db.execute({ sql: "SELECT * FROM laundry_orders WHERE job_id = ?", args: [jobId] })).rows[0] as Row | undefined) ?? null;
}

/**
 * Who gets what when a delivered laundry order is paid out (or a dispute is ruled on).
 * - `refundUgx` is a dispute refund taken from the goods. A full refund returns everything held.
 * - Peebee's commission comes off the goods only. The rider share (both ride legs) is kept
 *   aside in `riderFeeUgx` for the rider payout; the provider never receives it.
 * - A conditional tip is paid only for an on-time delivery with no dispute, otherwise it goes back to the customer.
 */
export function planLaundrySettlement(
  job: Row,
  order: Row,
  provider: { userId: string },
  opts: { refundUgx: number; to: "settled" | "refunded"; disputed: boolean; now?: Date },
): { money: MoneyPlan[]; platformUgx: number; riderFeeUgx: number } {
  const held = Number(job.held_ugx);
  const customerId = String(job.customer_id);
  const goods = Number(order.goods_ugx);
  const fee = Number(order.fee_ugx);
  const note = String(job.service_name);

  if (opts.to === "refunded" || opts.refundUgx >= goods) {
    return { money: [{ kind: "refund", userId: customerId, amount: held, note: `Peebee Work refund — ${note}` }], platformUgx: 0, riderFeeUgx: 0 };
  }

  const goodsRefund = Math.max(0, Math.round(opts.refundUgx));
  const tipKind = String(order.tip_kind);
  const tipReleased =
    tipKind === "free" ||
    (tipKind === "conditional" && !!order.tip_promised_by &&
      conditionalTipReleased({ disputed: opts.disputed || goodsRefund > 0, deliveredAt: opts.now ?? new Date(), promisedBy: fromDb(String(order.tip_promised_by)) }));

  const s = settleLaundry({
    goodsUgx: goods - goodsRefund, commissionPercent: Number(job.commission_percent), customerRideUgx: Number(order.customer_ride_ugx),
    providerRideUgx: Number(order.provider_ride_ugx), tipUgx: Number(order.tip_ugx), tipReleased, feeUgx: fee,
    commissionTakenAtCheckout: order.commission_timing === "at_checkout",
  });
  return {
    money: [
      { kind: "refund", userId: customerId, amount: goodsRefund + s.tipRefundUgx, note: `Peebee Work refund — ${note}` },
      { kind: "payout", userId: provider.userId, amount: s.providerUgx, note: `Peebee Work earnings — ${note}` },
    ],
    // Peebee's total take on the order: commission on the goods plus the customer fee, whichever moment each was booked.
    platformUgx: s.commissionUgx + fee,
    riderFeeUgx: s.riderUgx,
  };
}

/** What a cancelled laundry order gives back, following the rule locked in at checkout. */
export function planLaundryCancel(job: Row, order: Row): { money: MoneyPlan[]; platformUgx: number } {
  const c = cancelLaundry({
    heldUgx: Number(job.held_ugx), commissionTakenAtCheckoutUgx: Number(order.commission_taken_ugx), feeUgx: Number(order.fee_ugx),
    rule: order.cancel_rule === "keep" ? "keep" : "refund",
  });
  return { money: [{ kind: "refund", userId: String(job.customer_id), amount: c.customerRefundUgx, note: `Peebee Work refund — ${job.service_name}` }], platformUgx: c.platformUgx };
}
