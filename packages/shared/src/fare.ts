/**
 * How amounts are rounded — one rule for every price, fee, discount and rider earning (Admin → Pricing → Rounding).
 *
 * The default keeps amounts to whole UGX 500s and rounds UP to the next 500 once an amount is more than UGX 100 into it:
 * 23,600 -> 23,500, 64,300 -> 64,500, 29,700 -> 30,000. An admin can change the step (500 or 1,000), how far into a step
 * it takes to round up, or switch rounding off (whole shillings).
 *
 * The rule is held here, set once per request by the API from the admin's setting, so every caller — fares, offers, fees,
 * commissions — rounds the same way without passing it around. Apps that run without the API use the default.
 */
export type RoundingRule = {
  enabled: boolean;
  /** Amounts become multiples of this: 500 or 1,000. */
  step: 500 | 1000;
  /** Round up to the next step when the amount is MORE than this far into it (0–step-1). */
  roundUpAfter: number;
};

export const DEFAULT_ROUNDING_RULE: RoundingRule = { enabled: true, step: 500, roundUpAfter: 100 };

/** Keeps a stored or typed rule inside what makes sense. */
export function normaliseRoundingRule(raw: Partial<RoundingRule> | null | undefined): RoundingRule {
  const step = raw?.step === 1000 ? 1000 : 500;
  const after = Number(raw?.roundUpAfter);
  return {
    enabled: raw?.enabled !== false,
    step,
    roundUpAfter: Number.isFinite(after) ? Math.min(step - 1, Math.max(0, Math.floor(after))) : DEFAULT_ROUNDING_RULE.roundUpAfter,
  };
}

let active: RoundingRule = DEFAULT_ROUNDING_RULE;

export function setRoundingRule(rule: Partial<RoundingRule> | null | undefined): void {
  active = normaliseRoundingRule(rule);
}

export function getRoundingRule(): RoundingRule {
  return active;
}

/** Rounds one amount under a rule. With rounding off, to the whole shilling. Zero and negatives stay at zero. */
export function roundWith(rule: RoundingRule, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!rule.enabled) return Math.round(amount);
  // Work in whole thousandths of a shilling so 6,000 + 10% (6,600.0000000000001) is exactly 100 into its step, not past it.
  const exact = Math.round(amount * 1000) / 1000;
  const lower = Math.floor(exact / rule.step) * rule.step;
  return exact - lower > rule.roundUpAfter ? lower + rule.step : lower;
}

/** An amount under the current rule (23,600 -> 23,500; 29,700 -> 30,000 by default). */
export function round500(amount: number): number {
  return roundWith(active, amount);
}

/**
 * The nearest whole step, with no lean either way (a tie goes up). For amounts worked out as a share of something —
 * commissions, discounts, cashback, bonuses, fees — where leaning up would quietly raise a 12% cut to 15%.
 * The step and the on/off switch still come from the admin's rule.
 */
export function roundNearest(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!active.enabled) return Math.round(amount);
  return Math.round(amount / active.step) * active.step;
}

/** The largest whole step that is not more than `amount`, for caps that must not be exceeded. */
export function floor500(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = active.enabled ? active.step : 1;
  return Math.floor(amount / step) * step;
}

/** A minimum or ceiling typed by an admin, raised to a whole step. */
export function ceil500(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = active.enabled ? active.step : 1;
  return Math.ceil(amount / step) * step;
}

/** Always a whole UGX 500, whatever the rule: for amounts the database insists on keeping in 500s (waiting and cancellation fees). */
export function snap500(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return roundWith({ enabled: true, step: 500, roundUpAfter: DEFAULT_ROUNDING_RULE.roundUpAfter }, amount);
}

/** A customer fare under the rule, never below the minimum (itself kept to a whole step). Item prices are never rounded here. */
export function roundFare(amount: number, minimum = 500): number {
  return Math.max(round500(amount), ceil500(Math.max(minimum, active.enabled ? 500 : 0)));
}

/**
 * The small note shown under a rounded amount: "rounded up from 24,600". Null when nothing was rounded
 * (the amount is what it was, or it is a minimum fare, where the caller passes no `from`).
 */
export function roundedFromNote(from: number | null | undefined, amount: number | null | undefined): string | null {
  if (from == null || amount == null || !Number.isFinite(from) || !Number.isFinite(amount)) return null;
  const exact = Math.round(from);
  if (exact === amount) return null;
  return `rounded ${amount > exact ? "up" : "down"} from ${exact.toLocaleString("en-UG")}`;
}
