import { db } from "../db/client.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import type { WorkSettings } from "./settings.js";
import { checkCancellation } from "./onsite.js";
import { isLaundryJob, laundryOrderFor, planLaundryCancel, planLaundrySettlement } from "./laundry-orders.js";
import {
  applyMoney, applyPendingMoney, chargeCustomer, dropUnpaidHold, fromDb, inMinutes, logEvent, notifyCustomer, notifyProviders, percentOf, publicProvider,
  splitHeld, toDb, transition, workExtrasReady, type ActorKind, type MoneyPlan, type Row,
} from "./service.js";

export type Actor = { id: string | null; kind: ActorKind };
export type Failure = { ok: false; status: 402 | 403 | 404 | 409; error: string; message: string };
export type Done = { ok: true };

const fail = (status: Failure["status"], error: string, message: string): Failure => ({ ok: false, status, error, message });
const env = (job: Row): PlatformEnvironment => (job.environment === "sandbox" ? "sandbox" : "live");

export async function getJob(id: string): Promise<Row | null> {
  return ((await db.execute({ sql: "SELECT * FROM work_jobs WHERE id = ?", args: [id] })).rows[0] as Row | undefined) ?? null;
}

export async function getProvider(id: string | null | undefined): Promise<Row | null> {
  if (!id) return null;
  return ((await db.execute({ sql: "SELECT * FROM work_providers WHERE id = ?", args: [id] })).rows[0] as Row | undefined) ?? null;
}

/** Puts money back into a wallet outside the normal status changes (a rare race). Exactly once per tag. */
async function refundOnce(job: Row, userId: string, amount: number, tag: string, note: string) {
  if (amount <= 0) return;
  const id = `refund:${job.id}:${tag}`;
  await db.execute({
    sql: "INSERT OR IGNORE INTO work_money (id, job_id, user_id, kind, amount_ugx, status, note, environment) VALUES (?, ?, ?, 'refund', ?, 'pending', ?, ?)",
    args: [id, job.id, userId, amount, note, env(job)],
  });
  await applyMoney(id);
}

// ---------------------------------------------------------------------------
// Assigning a provider. Used by: a provider accepting (broadcast), the customer
// picking an offer, and staff assigning by hand. One conditional update decides
// the winner when several try at once.
// ---------------------------------------------------------------------------

export async function assignProvider(
  job: Row,
  provider: Row,
  opts: { actor: Actor; workerId?: string; offerPriceUgx?: number },
): Promise<Done | Failure> {
  if (job.status !== "open") return fail(409, "not_open", "That job has already been taken or closed.");
  const workerId = opts.workerId ?? String(provider.user_id);
  const now = toDb();
  const base = { provider_id: provider.id, worker_id: workerId, assigned_at: now };

  // A fixed-price job is already paid for: assigning it makes it ready to start.
  if (job.pricing_mode === "fixed") {
    const ok = await transition({
      jobId: String(job.id), from: ["open"], to: "booked", set: { ...base, booked_at: now, expires_at: null },
      environment: env(job), actor: opts.actor, action: "assigned", detail: { providerId: provider.id },
    });
    return ok ? { ok: true } : fail(409, "not_open", "That job has already been taken or closed.");
  }

  // Quote-priced, with a price already on the table (the customer picked an offer).
  if (opts.offerPriceUgx && opts.offerPriceUgx > 0) {
    const price = opts.offerPriceUgx;
    const extra = price - Number(job.held_ugx);
    if (extra > 0) {
      const result = await chargeCustomer({
        jobId: String(job.id), key: `offer:${provider.id}:${price}`, customerId: String(job.customer_id), amount: extra, environment: env(job),
        note: `Peebee Work — ${job.service_name}`,
        then: {
          sql: `UPDATE work_jobs SET status = 'booked', provider_id = ?, worker_id = ?, assigned_at = ?, booked_at = ?, price_ugx = ?, held_ugx = ?, expires_at = NULL,
                  updated_at = datetime('now') WHERE id = ? AND status = 'open'`,
          args: [provider.id, workerId, now, now, price, price, job.id],
        },
      });
      if (!result.charged) {
        await dropUnpaidHold(String(job.id), `offer:${provider.id}:${price}`);
        return fail(402, "insufficient_wallet", `Add UGX ${extra.toLocaleString("en-UG")} to your wallet to accept this price.`);
      }
      if (!result.applied) {
        // Only the request that took the money may give it back. A repeat of the same tap sees it already charged and must leave it alone.
        if (result.debited) await refundOnce(job, String(job.customer_id), extra, `offer-${provider.id}`, "Peebee Work — job was taken before payment completed");
        return fail(409, "not_open", "That job has already been taken or closed.");
      }
      await logEvent(String(job.id), opts.actor.id, opts.actor.kind, "assigned", { providerId: provider.id, priceUgx: price });
      return { ok: true };
    }
    const ok = await transition({
      jobId: String(job.id), from: ["open"], to: "booked", set: { ...base, booked_at: now, price_ugx: price, expires_at: null },
      environment: env(job), actor: opts.actor, action: "assigned", detail: { providerId: provider.id, priceUgx: price },
    });
    return ok ? { ok: true } : fail(409, "not_open", "That job has already been taken or closed.");
  }

  // Quote-priced, no price yet: the provider will inspect and quote.
  const ok = await transition({
    jobId: String(job.id), from: ["open"], to: "assigned", set: { ...base, expires_at: null },
    environment: env(job), actor: opts.actor, action: "assigned", detail: { providerId: provider.id },
  });
  return ok ? { ok: true } : fail(409, "not_open", "That job has already been taken or closed.");
}

// ---------------------------------------------------------------------------
// Cancelling
// ---------------------------------------------------------------------------

export async function cancelJob(job: Row, by: ActorKind, actorId: string | null, settings: WorkSettings, reason: string): Promise<Done | Failure> {
  const held = Number(job.held_ugx);
  const status = String(job.status);
  const provider = await getProvider(job.provider_id);
  const providerUser = provider ? String(provider.user_id) : null;
  const money: MoneyPlan[] = [];
  let commission = 0;

  const cancellable = by === "admin" ? ["open", "assigned", "quoted", "booked", "in_progress"] : ["open", "assigned", "quoted", "booked"];
  if (by === "provider" && status === "open") return fail(409, "not_assigned", "You haven't taken this job.");
  if (!cancellable.includes(status)) {
    return fail(409, "cannot_cancel", status === "in_progress" || status === "completed"
      ? "This job has started. If something is wrong, report a problem instead." : "This job can't be cancelled now.");
  }

  // A laundry order follows its own money rules (rider share, tip, Peebee's fee), locked in when it was placed.
  const laundry = isLaundryJob(job) ? await laundryOrderFor(String(job.id)) : null;
  if (laundry) {
    const plan = planLaundryCancel(job, laundry);
    money.push(...plan.money);
    commission = plan.platformUgx;
  } else if (by === "customer" && status !== "open" && held > 0 && providerUser) {
    // After a provider is on the job, a late cancellation pays them a share.
    const sinceAssigned = job.assigned_at ? (Date.now() - fromDb(String(job.assigned_at)).getTime()) / 60_000 : Infinity;
    const free = sinceAssigned <= settings.freeCancelMinutes;
    const fee = free ? 0 : percentOf(held, settings.lateCancelFeePercent);
    const split = splitHeld(held, Number(job.commission_percent), held - fee);
    commission = split.commission;
    money.push({ kind: "refund", userId: String(job.customer_id), amount: split.refund, note: `Peebee Work cancellation — ${job.service_name}` });
    money.push({ kind: "payout", userId: providerUser, amount: split.payout, note: `Peebee Work cancellation fee — ${job.service_name}` });
  } else {
    money.push({ kind: "refund", userId: String(job.customer_id), amount: held, note: `Peebee Work refund — ${job.service_name}` });
  }

  const ok = await transition({
    jobId: String(job.id), from: cancellable.filter((s) => s === status), to: "cancelled",
    set: { cancelled_at: toDb(), cancelled_by: by, cancel_reason: reason.slice(0, 300), commission_ugx: commission },
    money, environment: env(job), actor: { id: actorId, kind: by }, action: "cancelled", detail: { reason },
  });
  if (!ok) return fail(409, "cannot_cancel", "This job just changed. Refresh and try again.");
  notifyCustomer(job, "Your booking was cancelled", String(job.service_name));
  if (by === "customer" || by === "provider") await checkCancellation(job, by, settings);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// A provider backing out. If admin allows it (and migration 0099 is applied), the
// job goes back to the other providers instead of being refunded and closed, so
// the customer is not left to start again. The money stays held.
// ---------------------------------------------------------------------------

export async function providerCancel(job: Row, actorId: string | null, settings: WorkSettings, reason: string): Promise<(Done & { rematched: boolean }) | Failure> {
  const status = String(job.status);
  const quote = job.pricing_mode === "quote";
  // A fixed-price job stays paid for and can go back out as it is. A quote job can go back out before the customer
  // has accepted a price (the call-out fee stays held). Once a quote is accepted the customer paid for that provider's
  // price, so a cancellation there is refunded as before.
  const reopenable = quote ? ["assigned", "quoted"].includes(status) : status === "booked";
  const canRematch =
    settings.rematchOnProviderCancel && reopenable && Number(job.rematch_count ?? 0) < settings.maxRematches && job.provider_id && (await workExtrasReady());
  if (!canRematch) {
    const done = await cancelJob(job, "provider", actorId, settings, reason);
    return done.ok ? { ok: true, rematched: false } : done;
  }

  const providerId = String(job.provider_id);
  const ok = await transition({
    jobId: String(job.id), from: [status], to: "open",
    set: {
      provider_id: null, worker_id: null, assigned_at: null, booked_at: null, quoted_at: null, quote_expires_at: null,
      ...(quote ? { price_ugx: 0 } : {}),
      expires_at: inMinutes(settings.offerWindowMinutes),
      rematch_count: Number(job.rematch_count ?? 0) + 1,
      provider_lat: null, provider_lng: null, provider_located_at: null,
    },
    where: { sql: "provider_id = ?", args: [providerId] },
    environment: env(job), actor: { id: actorId, kind: "provider" }, action: "provider_cancelled", detail: { providerId, reason: reason.slice(0, 300) },
  });
  if (!ok) return fail(409, "cannot_cancel", "This job just changed. Refresh and try again.");

  // Others' offers come back to the customer; this provider's does not.
  await db.execute({ sql: "UPDATE work_offers SET status = 'withdrawn' WHERE job_id = ? AND provider_id = ?", args: [job.id, providerId] });
  await db.execute({ sql: "UPDATE work_offers SET status = 'pending' WHERE job_id = ? AND provider_id != ? AND status IN ('selected', 'declined')", args: [job.id, providerId] });
  await logEvent(String(job.id), null, "system", "rematched", { attempt: Number(job.rematch_count ?? 0) + 1 });

  const fresh = (await getJob(String(job.id))) as Row;
  await checkCancellation(job, "provider", settings);
  notifyCustomer(fresh, "Your provider had to cancel", "We're finding you another one.");
  if (fresh.matching_mode === "broadcast" || fresh.matching_mode === "customer_picks") await notifyProviders(fresh, settings);
  return { ok: true, rematched: true };
}

// ---------------------------------------------------------------------------
// Paying out (customer confirms, auto-confirm, or an admin rules on a dispute)
// ---------------------------------------------------------------------------

export async function settleJob(
  job: Row,
  opts: { from: string[]; to: "settled" | "refunded"; refundUgx: number; actor: Actor; action: string; note?: string; resolvedBy?: string },
): Promise<Done | Failure> {
  const provider = await getProvider(job.provider_id);
  if (!provider) return fail(409, "no_provider", "This job has no provider.");
  const laundry = isLaundryJob(job) ? await laundryOrderFor(String(job.id)) : null;
  const plan = laundry ? planLaundrySettlement(job, laundry, { userId: String(provider.user_id) }, { refundUgx: opts.refundUgx, to: opts.to, disputed: String(job.status) === "disputed" }) : null;
  const held = Number(job.held_ugx);
  const split = plan ? { commission: plan.platformUgx, payout: plan.money.find((m) => m.kind === "payout")?.amount ?? 0 } : splitHeld(held, Number(job.commission_percent), opts.refundUgx);
  const money: MoneyPlan[] = plan ? plan.money : [
    { kind: "refund", userId: String(job.customer_id), amount: (split as ReturnType<typeof splitHeld>).refund, note: `Peebee Work refund — ${job.service_name}` },
    { kind: "payout", userId: String(provider.user_id), amount: split.payout, note: `Peebee Work earnings — ${job.service_name}` },
  ];
  const set: Record<string, unknown> = { settled_at: toDb(), commission_ugx: split.commission };
  if (opts.note) set.resolution_note = opts.note.slice(0, 500);
  if (opts.resolvedBy) set.resolved_by = opts.resolvedBy;
  const ok = await transition({
    jobId: String(job.id), from: opts.from, to: opts.to, set, money, environment: env(job), actor: opts.actor, action: opts.action,
    detail: { refundUgx: plan ? (plan.money.find((m) => m.kind === "refund")?.amount ?? 0) : (split as ReturnType<typeof splitHeld>).refund, payoutUgx: split.payout, commissionUgx: split.commission },
  });
  if (!ok) return fail(409, "already_settled", "This job was already paid out or changed.");
  // The rider share of a laundry order is not the provider's: record it for the rider payout.
  if (plan && plan.riderFeeUgx > 0) await db.execute({ sql: "UPDATE laundry_orders SET rider_fee_ugx = ? WHERE job_id = ?", args: [plan.riderFeeUgx, job.id] });
  if (split.payout > 0) {
    await db.execute({ sql: "UPDATE work_providers SET jobs_completed = jobs_completed + 1, updated_at = datetime('now') WHERE id = ?", args: [provider.id] });
  }
  await applyPendingMoney(String(job.id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// What the apps see
// ---------------------------------------------------------------------------

export async function jobView(job: Row, viewer: "customer" | "provider" | "admin") {
  const provider = await getProvider(job.provider_id);
  const worker = job.worker_id
    ? ((await db.execute({ sql: "SELECT name FROM users WHERE id = ?", args: [job.worker_id] })).rows[0] as Row | undefined)
    : undefined;
  // A provider learns who the customer is only once the job is theirs.
  const customer =
    viewer === "provider" && job.provider_id && job.status !== "open"
      ? ((await db.execute({ sql: "SELECT name, phone FROM users WHERE id = ?", args: [job.customer_id] })).rows[0] as Row | undefined)
      : undefined;
  // When the provider marked themselves as arrived (only meaningful while they are on the job).
  const arrived = ["booked", "in_progress"].includes(String(job.status))
    ? ((await db.execute({ sql: "SELECT MIN(created_at) AS at FROM work_events WHERE job_id = ? AND action = 'arrived' AND created_at >= COALESCE(?, '')", args: [job.id, job.assigned_at ?? null] })).rows[0] as Row | undefined)
    : undefined;
  const arrivedAt = (arrived?.at as string | null | undefined) ?? null;
  return {
    id: job.id,
    status: job.status,
    customer: customer ? { name: customer.name, phone: customer.phone ?? null } : null,
    service: { id: job.service_id, type: job.service_type, name: job.service_name },
    pricingMode: job.pricing_mode,
    matchingMode: job.matching_mode,
    quantity: Number(job.quantity),
    details: job.details,
    address: job.address,
    area: job.area ?? null,
    lat: job.lat ?? null,
    lng: job.lng ?? null,
    scheduledFor: job.scheduled_for ?? null,
    unitPriceUgx: Number(job.unit_price_ugx),
    calloutFeeUgx: Number(job.callout_fee_ugx),
    priceUgx: Number(job.price_ugx),
    heldUgx: Number(job.held_ugx),
    commissionPercent: Number(job.commission_percent),
    commissionUgx: Number(job.commission_ugx),
    expiresAt: job.expires_at ?? null,
    quoteExpiresAt: job.quote_expires_at ?? null,
    confirmBy: job.confirm_by ?? null,
    provider: viewer === "admin" ? provider : publicProvider(provider),
    workerName: worker?.name ?? null,
    rating: job.rating ?? null,
    review: job.review ?? null,
    cancelReason: job.cancel_reason ?? null,
    cancelledBy: job.cancelled_by ?? null,
    disputeReason: job.dispute_reason ?? null,
    resolutionNote: job.resolution_note ?? null,
    createdAt: job.created_at,
    assignedAt: job.assigned_at ?? null,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    settledAt: job.settled_at ?? null,
    arrivedAt,
    rematchCount: Number(job.rematch_count ?? 0),
    // Where the provider is while the job is on (customer and staff only; the provider already knows).
    providerLocation:
      viewer !== "provider" && job.provider_lat != null && job.provider_lng != null && ["booked", "in_progress"].includes(String(job.status))
        ? { lat: Number(job.provider_lat), lng: Number(job.provider_lng), updatedAt: job.provider_located_at ?? null }
        : null,
  };
}

/** What the customer can do next, so the app doesn't have to know the rules. */
export function customerActions(job: Row, settings: WorkSettings): string[] {
  const s = String(job.status);
  const actions: string[] = [];
  if (["open", "assigned", "quoted", "booked"].includes(s)) actions.push("cancel");
  if (s === "quoted") actions.push("accept_quote", "decline_quote");
  if (s === "open" && job.matching_mode === "customer_picks") actions.push("choose_provider");
  if (s === "completed") {
    actions.push("confirm");
    const deadline = job.completed_at ? fromDb(String(job.completed_at)).getTime() + settings.disputeWindowHours * 3_600_000 : 0;
    if (Date.now() <= deadline) actions.push("report_problem");
  }
  if (s === "settled" && job.rating == null) actions.push("rate");
  return actions;
}

