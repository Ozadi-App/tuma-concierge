import { db, executeBatch } from "../db/client.js";
import { newId } from "../lib/ids.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { balanceColumn, inDays, parseList, percentOf, toDb, type Row } from "./service.js";
import { getTalentSettings, type TalentSettings } from "./settings.js";

/**
 * How Peebee Jobs earns, as data an admin edits rather than code:
 *
 *  - FEE RULES (talent_fee_rules): a flat amount, a percentage (with a minimum and
 *    maximum), or nothing, for each thing that can be charged: onboarding, posting a
 *    job, boosting, applying, a hiring placement, unlocking a contact, and the
 *    commission on gigs and projects (taken from the employer and from the worker).
 *    A rule can be specific to gig / project / hiring posts, and can give the first
 *    N of each month for free.
 *  - PLANS (talent_plans): a subscription that unlocks Pro features, waives some fees
 *    and can lower the commission, with its own free trial.
 *  - PRO FEATURES (talent_features): admin marks which features need a plan.
 *  - THE SWITCHES: "free access" overrides everything, "free onboarding" waives the
 *    onboarding fees, and a platform-wide trial gives new people every Pro feature
 *    for a while.
 *
 * Nothing is charged unless a rule is active AND free access is off. Every charge,
 * waiver and amount owed is written to talent_charges with its reason.
 */

export type FeeKind =
  | "worker_onboarding" | "employer_onboarding" | "listing" | "boost" | "application" | "hire_fee" | "contact_unlock" | "employer_commission" | "worker_commission" | "late_cancel_fee" | "cancel_compensation";
export type Audience = "worker" | "employer";
export const FEE_KINDS: readonly FeeKind[] = [
  "worker_onboarding", "employer_onboarding", "listing", "boost", "application", "hire_fee", "contact_unlock", "employer_commission", "worker_commission",
];

const COMMISSION: readonly FeeKind[] = ["employer_commission", "worker_commission"];
const ONBOARDING: readonly FeeKind[] = ["worker_onboarding", "employer_onboarding"];

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** The rule for this kind, preferring one made for this job type over the general one. */
export async function getRule(kind: FeeKind, jobType: string): Promise<Row | null> {
  const row = (
    await db.execute({
      sql: "SELECT * FROM talent_fee_rules WHERE kind = ? AND job_type IN (?, '') ORDER BY job_type DESC LIMIT 1",
      args: [kind, jobType],
    })
  ).rows[0] as Row | undefined;
  return row ?? null;
}

/** What a rule asks for on `base` (the job's price, budget or pay; ignored by flat rules). */
export function ruleAmount(rule: Row | null, base: number): number {
  if (!rule || Number(rule.active) !== 1 || rule.model === "free") return 0;
  let amount = rule.model === "flat" ? Number(rule.flat_ugx) : percentOf(Math.max(0, base), Number(rule.percent));
  if (rule.model === "percent") {
    if (Number(rule.min_ugx) > 0) amount = Math.max(amount, Number(rule.min_ugx));
    if (Number(rule.max_ugx) > 0) amount = Math.min(amount, Number(rule.max_ugx));
  }
  return Math.max(0, Math.round(amount));
}

// ---------------------------------------------------------------------------
// What a person is entitled to: plans and trials
// ---------------------------------------------------------------------------

export type Entitlement = {
  /** Active plan or trial rows. */
  subs: Row[];
  plans: Row[];
  trial: Row | null;
  waived: Set<string>;
};

export async function entitlementFor(userId: string, audience: Audience): Promise<Entitlement> {
  const subs = (
    await db.execute({
      sql: `SELECT * FROM talent_subscriptions WHERE user_id = ? AND audience = ? AND status IN ('trial', 'active') AND expires_at > datetime('now')
            ORDER BY expires_at DESC`,
      args: [userId, audience],
    })
  ).rows as Row[];
  const planIds = subs.filter((s) => s.plan_id).map((s) => String(s.plan_id));
  const plans = planIds.length
    ? ((await db.execute({ sql: `SELECT * FROM talent_plans WHERE id IN (${planIds.map(() => "?").join(", ")})`, args: planIds })).rows as Row[])
    : [];
  const trial = subs.find((s) => !s.plan_id) ?? null;
  // A trial gives everything the audience's plans give: it is a taste of Pro.
  const trialPlans = trial
    ? ((await db.execute({ sql: "SELECT * FROM talent_plans WHERE audience = ? AND active = 1", args: [audience] })).rows as Row[])
    : [];
  const waived = new Set<string>([...plans, ...trialPlans].flatMap((p) => parseList(p.waived_kinds)));
  return { subs, plans, trial, waived };
}

/** The lowest commission percentage any of the person's plans promises, or null for "no plan changes it". */
function planCommission(ent: Entitlement, kind: "employer_commission" | "worker_commission"): number | null {
  const field = kind === "employer_commission" ? "employer_commission_percent" : "worker_commission_percent";
  const values = ent.plans.map((p) => p[field]).filter((v) => v !== null && v !== undefined).map(Number);
  return values.length ? Math.min(...values) : null;
}

// ---------------------------------------------------------------------------
// Pro features
// ---------------------------------------------------------------------------

export async function featureStatus(userId: string, settings?: TalentSettings): Promise<{ key: string; label: string; description: string; audience: string; pro: boolean; unlocked: boolean; via: string | null }[]> {
  const s = settings ?? (await getTalentSettings());
  const features = (await db.execute({ sql: "SELECT * FROM talent_features ORDER BY sort_order, key", args: [] })).rows as Row[];
  const [worker, employer] = await Promise.all([entitlementFor(userId, "worker"), entitlementFor(userId, "employer")]);
  return features.map((f) => {
    const pro = Number(f.pro) === 1;
    let via: string | null = null;
    if (!pro) via = "included";
    else if (s.freeAccess) via = "free_access";
    else {
      for (const [aud, ent] of [["worker", worker], ["employer", employer]] as const) {
        if (f.audience !== "both" && f.audience !== aud) continue;
        if (ent.trial) via = "trial";
        if (ent.plans.some((p) => parseList(p.features).includes(String(f.key)))) {
          via = "plan";
          break;
        }
      }
    }
    return { key: String(f.key), label: String(f.label), description: String(f.description), audience: String(f.audience), pro, unlocked: via !== null, via };
  });
}

export async function hasFeature(userId: string, key: string): Promise<boolean> {
  const status = await featureStatus(userId);
  const f = status.find((x) => x.key === key);
  return f ? f.unlocked : true;
}

/**
 * For perks that LIFT A LIMIT (unlimited applications): true only when the feature is
 * Pro and the person genuinely has it through a plan or trial. Unlike `hasFeature`, a
 * feature that is open to everyone does NOT count, otherwise the limit would never apply.
 */
export async function hasProPerk(userId: string, key: string): Promise<boolean> {
  const f = (await featureStatus(userId)).find((x) => x.key === key);
  return Boolean(f && f.pro && (f.via === "plan" || f.via === "trial"));
}

/** Worker ids whose plan or trial includes a Pro perk (used to rank featured profiles). */
export async function usersWithProPerk(key: string): Promise<Set<string>> {
  const feature = (await db.execute({ sql: "SELECT pro FROM talent_features WHERE key = ?", args: [key] })).rows[0] as Row | undefined;
  if (!feature || Number(feature.pro) !== 1) return new Set();
  const rows = (
    await db.execute({
      sql: `SELECT DISTINCT sub.user_id FROM talent_subscriptions sub LEFT JOIN talent_plans pl ON pl.id = sub.plan_id
            WHERE sub.audience = 'worker' AND sub.status IN ('trial', 'active') AND sub.expires_at > datetime('now')
              AND (pl.features LIKE ? OR (sub.plan_id IS NULL AND sub.status = 'trial'))`,
      args: [`%"${key}"%`],
    })
  ).rows as Row[];
  return new Set(rows.map((r) => String(r.user_id)));
}

/** The standard "this needs Pro" refusal. */
export const proRequired = (key: string) => ({ error: "pro_required", feature: key, message: "This is a Pro feature. Start your free trial or choose a plan to use it." });

// ---------------------------------------------------------------------------
// Quoting and charging
// ---------------------------------------------------------------------------

export type Quote = {
  kind: FeeKind;
  amount: number;
  /** Why it costs nothing, when it doesn't. */
  waived: "free_access" | "free_onboarding" | "no_fee" | "plan" | "free_first_n" | null;
  ruleId: string | null;
};

const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01 00:00:00`;

export async function quoteFee(input: { userId: string; audience: Audience; kind: FeeKind; jobType?: string; base?: number; settings?: TalentSettings }): Promise<Quote> {
  const settings = input.settings ?? (await getTalentSettings());
  const rule = await getRule(input.kind, input.jobType ?? "");
  const ruleId = rule ? String(rule.id) : null;
  const done = (amount: number, waived: Quote["waived"]): Quote => ({ kind: input.kind, amount, waived, ruleId });

  if (settings.freeAccess) return done(0, "free_access");
  if (ONBOARDING.includes(input.kind) && settings.freeOnboarding) return done(0, "free_onboarding");

  const ent = await entitlementFor(input.userId, input.audience);
  let amount = ruleAmount(rule, input.base ?? 0);
  // A plan can promise a lower commission than the general rule.
  if (COMMISSION.includes(input.kind) && rule && Number(rule.active) === 1) {
    const promised = planCommission(ent, input.kind as "employer_commission" | "worker_commission");
    if (promised !== null) amount = Math.min(amount, percentOf(Math.max(0, input.base ?? 0), promised));
  }
  if (amount <= 0) return done(0, "no_fee");
  if (ent.waived.has(input.kind)) return done(0, "plan");

  // "First N free each month" counts charges made, which commissions never log one by one.
  const free = COMMISSION.includes(input.kind) ? 0 : Number(rule?.free_first_n ?? 0);
  if (free > 0) {
    const used = Number(
      ((await db.execute({
        sql: `SELECT COUNT(*) AS n FROM talent_charges WHERE user_id = ? AND kind = ? AND created_at >= ? AND (status = 'paid' OR reason = 'free_first_n')`,
        args: [input.userId, input.kind, monthStart()],
      })).rows[0] as Row).n,
    );
    if (used < free) return done(0, "free_first_n");
  }
  return done(amount, null);
}

export type ChargeResult = { ok: true; amount: number; waived: Quote["waived"]; status: "paid" | "waived" | "due" } | { ok: false; error: "insufficient_funds"; needed: number; message: string };

/**
 * Quotes and takes a fee from the person's wallet. Repeating the same
 * `idempotencyKey` never charges twice. With `allowDue` a fee the wallet can't
 * cover is recorded as owed (used for commission on direct-pay work) instead of
 * being refused.
 */
export async function charge(input: {
  userId: string;
  audience: Audience;
  kind: FeeKind;
  jobType?: string;
  base?: number;
  jobId?: string;
  contractId?: string;
  idempotencyKey: string;
  environment: PlatformEnvironment;
  allowDue?: boolean;
  settings?: TalentSettings;
}): Promise<ChargeResult> {
  const prior = (await db.execute({ sql: "SELECT * FROM talent_charges WHERE idempotency_key = ?", args: [input.idempotencyKey] })).rows[0] as Row | undefined;
  if (prior && prior.status !== "due") return { ok: true, amount: Number(prior.amount_ugx), waived: null, status: prior.status === "waived" ? "waived" : "paid" };

  // A fee already recorded as owed is retried at the amount it was recorded at.
  const quote: Quote = prior ? { kind: input.kind, amount: Number(prior.amount_ugx), waived: null, ruleId: null } : await quoteFee(input);
  const id = prior ? String(prior.id) : newId("tch");
  if (quote.amount <= 0) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment)
            VALUES (?, ?, ?, ?, ?, 0, 'waived', ?, ?, ?)`,
      args: [id, input.userId, input.kind, input.jobId ?? null, input.contractId ?? null, quote.waived ?? "no_fee", input.idempotencyKey, input.environment],
    });
    return { ok: true, amount: 0, waived: quote.waived, status: "waived" };
  }
  if (!prior) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment)
            VALUES (?, ?, ?, ?, ?, ?, 'due', 'fee', ?, ?)`,
      args: [id, input.userId, input.kind, input.jobId ?? null, input.contractId ?? null, quote.amount, input.idempotencyKey, input.environment],
    });
  }
  const paid = await payChargeRow(id, input.userId, quote.amount, input.environment, `Peebee Jobs fee: ${input.kind.replace(/_/g, " ")}`);
  if (paid) return { ok: true, amount: quote.amount, waived: null, status: "paid" };
  if (input.allowDue) return { ok: true, amount: quote.amount, waived: null, status: "due" };
  await db.execute({ sql: "DELETE FROM talent_charges WHERE id = ? AND status = 'due'", args: [id] });
  return { ok: false, error: "insufficient_funds", needed: quote.amount, message: `Top up your wallet: this costs UGX ${quote.amount.toLocaleString("en-UG")}.` };
}

/**
 * Charges an amount that was already fixed (a contract's commission), as opposed to
 * `charge`, which works the amount out from the rules. With `allowDue` an amount the
 * wallet can't cover is recorded as owed instead of failing.
 */
export async function chargeFixed(input: {
  userId: string;
  kind: FeeKind;
  amount: number;
  jobId?: string;
  contractId?: string;
  idempotencyKey: string;
  environment: PlatformEnvironment;
  allowDue?: boolean;
}): Promise<{ status: "paid" | "due" | "none" }> {
  if (input.amount <= 0) return { status: "none" };
  const id = newId("tch");
  await db.execute({
    sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment)
          VALUES (?, ?, ?, ?, ?, ?, 'due', 'fee', ?, ?)`,
    args: [id, input.userId, input.kind, input.jobId ?? null, input.contractId ?? null, input.amount, input.idempotencyKey, input.environment],
  });
  const row = (await db.execute({ sql: "SELECT id, status FROM talent_charges WHERE idempotency_key = ?", args: [input.idempotencyKey] })).rows[0] as Row;
  if (row.status === "paid") return { status: "paid" };
  const paid = await payChargeRow(String(row.id), input.userId, input.amount, input.environment, `Peebee Jobs fee: ${input.kind.replace(/_/g, " ")}`);
  if (paid) return { status: "paid" };
  if (!input.allowDue) await db.execute({ sql: "DELETE FROM talent_charges WHERE id = ? AND status = 'due'", args: [row.id] });
  return { status: "due" };
}

/** Takes a 'due' charge from the wallet in one atomic batch. True if it is paid afterwards. */
async function payChargeRow(chargeId: string, userId: string, amount: number, env: PlatformEnvironment, note: string): Promise<boolean> {
  const col = balanceColumn(env);
  const DUE = "EXISTS (SELECT 1 FROM talent_charges WHERE id = ? AND status = 'due')";
  await executeBatch([
    { sql: `UPDATE users SET ${col} = ${col} - ?, updated_at = datetime('now') WHERE id = ? AND ${col} >= ? AND ${DUE}`, args: [amount, userId, amount, chargeId] },
    { sql: "UPDATE talent_charges SET status = 'paid' WHERE id = ? AND status = 'due' AND changes() > 0", args: [chargeId] },
    {
      sql: `INSERT INTO wallet_ledger (id, user_id, type, amount, balance_after, note, environment)
            SELECT ?, ?, 'adjustment', ?, (SELECT ${col} FROM users WHERE id = ?), ?, ? WHERE changes() > 0`,
      args: [newId("wl"), userId, -amount, userId, note, env],
    },
  ]);
  const row = (await db.execute({ sql: "SELECT status FROM talent_charges WHERE id = ?", args: [chargeId] })).rows[0] as Row | undefined;
  return row?.status === "paid";
}

/** Tries to settle everything the person owes (unpaid commission). Returns what was paid and what is still owed. */
export async function payDue(userId: string, env: PlatformEnvironment): Promise<{ paid: number; stillOwed: number }> {
  const rows = (await db.execute({ sql: "SELECT * FROM talent_charges WHERE user_id = ? AND status = 'due' ORDER BY created_at LIMIT 50", args: [userId] })).rows as Row[];
  let paid = 0;
  for (const r of rows) {
    if (await payChargeRow(String(r.id), userId, Number(r.amount_ugx), r.environment === "sandbox" ? "sandbox" : env, `Peebee Jobs fee: ${String(r.kind).replace(/_/g, " ")}`)) paid += Number(r.amount_ugx);
  }
  return { paid, stillOwed: await dueTotal(userId) };
}

export async function dueTotal(userId: string): Promise<number> {
  return Number(((await db.execute({ sql: "SELECT COALESCE(SUM(amount_ugx), 0) AS n FROM talent_charges WHERE user_id = ? AND status = 'due'", args: [userId] })).rows[0] as Row).n);
}

/** True if the person owes more unpaid fees than admin allows, so shouldn't take on new work. */
export async function overDueLimit(userId: string, settings: TalentSettings): Promise<boolean> {
  return (await dueTotal(userId)) > settings.unpaidCommissionLimitUgx;
}

// ---------------------------------------------------------------------------
// Commission on a contract
// ---------------------------------------------------------------------------

/**
 * The fees Peebee takes on a gig or project, fixed when the contract is made:
 * what the employer pays on top, and what comes off the worker's pay.
 */
export async function contractFees(input: { employerId: string; workerId: string; jobType: string; price: number; settings?: TalentSettings }): Promise<{ employerFee: number; workerFee: number }> {
  const settings = input.settings ?? (await getTalentSettings());
  if (settings.freeAccess) return { employerFee: 0, workerFee: 0 };
  const [emp, wrk] = await Promise.all([
    quoteFee({ userId: input.employerId, audience: "employer", kind: "employer_commission", jobType: input.jobType, base: input.price, settings }),
    quoteFee({ userId: input.workerId, audience: "worker", kind: "worker_commission", jobType: input.jobType, base: input.price, settings }),
  ]);
  // Structural safety rail: the worker fee can never swallow the whole price.
  return { employerFee: emp.amount, workerFee: Math.min(wrk.amount, Math.max(0, input.price - 1)) };
}

/** Splits `total` across `weights` so the parts add up to `total` exactly. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  let given = 0;
  return weights.map((w, i) => {
    if (i === weights.length - 1) return total - given;
    const part = Math.round((total * w) / sum);
    given += part;
    return part;
  });
}

// ---------------------------------------------------------------------------
// Trials and subscriptions
// ---------------------------------------------------------------------------

/** Gives a newly activated worker or employer the platform's free trial of every Pro feature (once per audience). */
export async function startTrial(userId: string, audience: Audience, env: PlatformEnvironment, settings?: TalentSettings): Promise<boolean> {
  const s = settings ?? (await getTalentSettings());
  if (s.trialDays <= 0) return false;
  const had = (await db.execute({ sql: "SELECT 1 FROM talent_subscriptions WHERE user_id = ? AND audience = ? AND status IN ('trial') LIMIT 1", args: [userId, audience] })).rows.length;
  const ever = (await db.execute({ sql: "SELECT 1 FROM talent_subscriptions WHERE user_id = ? AND audience = ? AND plan_id IS NULL LIMIT 1", args: [userId, audience] })).rows.length;
  if (had || ever) return false;
  await db.execute({
    sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, environment) VALUES (?, ?, ?, NULL, 'trial', ?, ?, ?)`,
    args: [newId("tsb"), userId, audience, toDb(), inDays(s.trialDays), env],
  });
  return true;
}

export type SubscribeResult =
  | { ok: true; subscription: Row; trial: boolean }
  | { ok: false; error: "plan_not_found" | "already_subscribed" | "insufficient_funds"; message: string; needed?: number };

/** Starts a plan: free if it has a trial the person hasn't used, otherwise paid from the wallet. */
export async function subscribe(userId: string, planId: string, env: PlatformEnvironment): Promise<SubscribeResult> {
  const plan = (await db.execute({ sql: "SELECT * FROM talent_plans WHERE (id = ? OR code = ?) AND active = 1", args: [planId, planId] })).rows[0] as Row | undefined;
  if (!plan) return { ok: false, error: "plan_not_found", message: "That plan isn't available." };
  const audience = plan.audience as Audience;
  const current = (await db.execute({
    sql: "SELECT 1 FROM talent_subscriptions WHERE user_id = ? AND plan_id = ? AND status IN ('trial', 'active') AND expires_at > datetime('now') LIMIT 1",
    args: [userId, plan.id],
  })).rows.length;
  if (current) return { ok: false, error: "already_subscribed", message: "You're already on this plan." };

  const usedTrial = (await db.execute({ sql: "SELECT 1 FROM talent_subscriptions WHERE user_id = ? AND plan_id = ? AND status = 'trial' LIMIT 1", args: [userId, plan.id] })).rows.length;
  const trialDays = Number(plan.trial_days);
  const settings = await getTalentSettings();
  const price = settings.freeAccess ? 0 : Number(plan.price_ugx);
  const id = newId("tsb");
  if (trialDays > 0 && !usedTrial && price > 0) {
    await db.execute({
      sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, auto_renew, environment) VALUES (?, ?, ?, ?, 'trial', ?, ?, 1, ?)`,
      args: [id, userId, audience, plan.id, toDb(), inDays(trialDays), env],
    });
    return { ok: true, subscription: (await db.execute({ sql: "SELECT * FROM talent_subscriptions WHERE id = ?", args: [id] })).rows[0] as Row, trial: true };
  }
  if (price > 0) {
    const col = balanceColumn(env);
    const changes = await executeBatch([
      { sql: `UPDATE users SET ${col} = ${col} - ?, updated_at = datetime('now') WHERE id = ? AND ${col} >= ?`, args: [price, userId, price] },
      {
        sql: `INSERT INTO wallet_ledger (id, user_id, type, amount, balance_after, note, environment)
              SELECT ?, ?, 'adjustment', ?, (SELECT ${col} FROM users WHERE id = ?), ?, ? WHERE changes() > 0`,
        args: [newId("wl"), userId, -price, userId, `Peebee Jobs plan: ${plan.name}`, env],
      },
      {
        sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, auto_renew, price_paid_ugx, environment)
              SELECT ?, ?, ?, ?, 'active', ?, ?, 1, ?, ? WHERE changes() > 0`,
        args: [id, userId, audience, plan.id, toDb(), inDays(Number(plan.period_days)), price, env],
      },
      {
        sql: `INSERT INTO talent_charges (id, user_id, kind, amount_ugx, status, reason, idempotency_key, environment)
              SELECT ?, ?, 'subscription', ?, 'paid', ?, ?, ? WHERE EXISTS (SELECT 1 FROM talent_subscriptions WHERE id = ?)`,
        args: [newId("tch"), userId, price, `plan:${plan.code}`, `sub:${id}`, env, id],
      },
    ]);
    if (changes[0] !== 1) return { ok: false, error: "insufficient_funds", message: `A ${plan.name} plan costs UGX ${price.toLocaleString("en-UG")}. Top up your wallet first.`, needed: price };
  } else {
    await db.execute({
      sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, auto_renew, price_paid_ugx, environment) VALUES (?, ?, ?, ?, 'active', ?, ?, 0, 0, ?)`,
      args: [id, userId, audience, plan.id, toDb(), inDays(Number(plan.period_days)), env],
    });
  }
  return { ok: true, subscription: (await db.execute({ sql: "SELECT * FROM talent_subscriptions WHERE id = ?", args: [id] })).rows[0] as Row, trial: false };
}

export async function cancelSubscription(userId: string, subscriptionId: string): Promise<boolean> {
  // Stops renewal; the paid period (or trial) still runs to its end.
  const res = await db.execute({
    sql: "UPDATE talent_subscriptions SET auto_renew = 0 WHERE id = ? AND user_id = ? AND status IN ('trial', 'active')",
    args: [subscriptionId, userId],
  });
  return (res.rowsAffected ?? 0) > 0;
}

/**
 * Run from the sweep. Ends lapsed plans; renews the ones set to renew if the
 * wallet can pay (otherwise they simply end). Platform-wide trials just end.
 */
export async function renewOrExpireSubscriptions(): Promise<{ renewed: number; expired: number }> {
  const lapsed = (await db.execute({ sql: "SELECT * FROM talent_subscriptions WHERE status IN ('trial', 'active') AND expires_at <= datetime('now') LIMIT 200", args: [] })).rows as Row[];
  let renewed = 0;
  let expired = 0;
  const settings = await getTalentSettings();
  for (const sub of lapsed) {
    const plan = sub.plan_id ? ((await db.execute({ sql: "SELECT * FROM talent_plans WHERE id = ? AND active = 1", args: [sub.plan_id] })).rows[0] as Row | undefined) : undefined;
    const env: PlatformEnvironment = sub.environment === "sandbox" ? "sandbox" : "live";
    const price = plan && !settings.freeAccess ? Number(plan.price_ugx) : 0;
    await db.execute({ sql: "UPDATE talent_subscriptions SET status = 'expired' WHERE id = ? AND status IN ('trial', 'active')", args: [sub.id] });
    expired += 1;
    if (plan && Number(sub.auto_renew) === 1) {
      const res = await subscribeRenewal(String(sub.user_id), plan, price, env);
      if (res) renewed += 1;
    }
  }
  return { renewed, expired };
}

async function subscribeRenewal(userId: string, plan: Row, price: number, env: PlatformEnvironment): Promise<boolean> {
  const id = newId("tsb");
  if (price > 0) {
    const col = balanceColumn(env);
    const changes = await executeBatch([
      { sql: `UPDATE users SET ${col} = ${col} - ?, updated_at = datetime('now') WHERE id = ? AND ${col} >= ?`, args: [price, userId, price] },
      {
        sql: `INSERT INTO wallet_ledger (id, user_id, type, amount, balance_after, note, environment)
              SELECT ?, ?, 'adjustment', ?, (SELECT ${col} FROM users WHERE id = ?), ?, ? WHERE changes() > 0`,
        args: [newId("wl"), userId, -price, userId, `Peebee Jobs plan renewal: ${plan.name}`, env],
      },
      {
        sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, auto_renew, price_paid_ugx, environment)
              SELECT ?, ?, ?, ?, 'active', ?, ?, 1, ?, ? WHERE changes() > 0`,
        args: [id, userId, plan.audience, plan.id, toDb(), inDays(Number(plan.period_days)), price, env],
      },
      {
        sql: `INSERT INTO talent_charges (id, user_id, kind, amount_ugx, status, reason, idempotency_key, environment)
              SELECT ?, ?, 'subscription', ?, 'paid', ?, ?, ? WHERE EXISTS (SELECT 1 FROM talent_subscriptions WHERE id = ?)`,
        args: [newId("tch"), userId, price, `renewal:${plan.code}`, `sub:${id}`, env, id],
      },
    ]);
    return changes[0] === 1;
  }
  await db.execute({
    sql: `INSERT INTO talent_subscriptions (id, user_id, audience, plan_id, status, started_at, expires_at, auto_renew, price_paid_ugx, environment) VALUES (?, ?, ?, ?, 'active', ?, ?, 1, 0, ?)`,
    args: [id, userId, plan.audience, plan.id, toDb(), inDays(Number(plan.period_days)), env],
  });
  return true;
}

// ---------------------------------------------------------------------------
// What the apps show: fee schedule and the person's own plan
// ---------------------------------------------------------------------------

/** A readable fee schedule for the apps (only active, non-free rules; empty while access is free). */
export async function publicFeeSchedule(settings: TalentSettings) {
  if (settings.freeAccess) return [];
  const rules = (await db.execute({ sql: "SELECT * FROM talent_fee_rules WHERE active = 1 AND model != 'free' ORDER BY kind, job_type", args: [] })).rows as Row[];
  return rules
    .filter((r) => !(ONBOARDING.includes(r.kind as FeeKind) && settings.freeOnboarding))
    .map((r) => ({
      kind: String(r.kind), jobType: String(r.job_type), model: String(r.model), flatUgx: Number(r.flat_ugx), percent: Number(r.percent),
      minUgx: Number(r.min_ugx), maxUgx: Number(r.max_ugx), freeFirstN: Number(r.free_first_n), note: String(r.note),
    }));
}

export async function myMembership(userId: string, settings: TalentSettings) {
  const [worker, employer] = await Promise.all([entitlementFor(userId, "worker"), entitlementFor(userId, "employer")]);
  const view = (ent: Entitlement) => ({
    trial: ent.trial ? { expiresAt: String(ent.trial.expires_at) } : null,
    subscriptions: ent.subs
      .filter((s) => s.plan_id)
      .map((s) => {
        const plan = ent.plans.find((p) => p.id === s.plan_id);
        return { id: String(s.id), planCode: plan ? String(plan.code) : null, planName: plan ? String(plan.name) : null, status: String(s.status), expiresAt: String(s.expires_at), autoRenew: Number(s.auto_renew) === 1 };
      }),
  });
  return {
    freeAccess: settings.freeAccess,
    worker: view(worker),
    employer: view(employer),
    owedUgx: await dueTotal(userId),
    features: await featureStatus(userId, settings),
  };
}
