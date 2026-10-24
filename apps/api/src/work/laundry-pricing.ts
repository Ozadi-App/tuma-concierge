/**
 * Pure laundry pricing rules: no database, no settings reads, so every rule is
 * easy to test. Amounts are whole UGX. The numbers that shape behaviour (band
 * percentages, step, who pays rides, tip limits) arrive as arguments from the
 * admin-controlled settings in laundry-settings.ts.
 */

export const LAUNDRY_TREATMENTS = ["wash", "dry_clean", "iron"] as const;
export type LaundryTreatment = (typeof LAUNDRY_TREATMENTS)[number];

export const RIDE_PAYERS = ["customer", "provider", "split"] as const;
export type RidePayer = (typeof RIDE_PAYERS)[number];

export type ItemPrices = { washUgx: number | null; dryCleanUgx: number | null; ironUgx: number | null };
export type OrderLine = { itemId: string; treatment: LaundryTreatment; count: number };

/** Unit price of one treatment, or null when the item doesn't offer it (or admin hasn't priced it). */
export function unitPrice(item: ItemPrices, treatment: LaundryTreatment): number | null {
  const p = treatment === "wash" ? item.washUgx : treatment === "dry_clean" ? item.dryCleanUgx : item.ironUgx;
  return p != null && p > 0 ? p : null;
}

/** Sum of count x unit price over the lines. Returns an error for a line that can't be priced. */
export function priceLines(
  lines: OrderLine[],
  items: Map<string, ItemPrices>,
): { ok: true; totalUgx: number; priced: { itemId: string; treatment: LaundryTreatment; count: number; unitUgx: number; lineUgx: number }[] } | { ok: false; error: string; itemId: string } {
  const priced = [];
  let totalUgx = 0;
  for (const l of lines) {
    const item = items.get(l.itemId);
    if (!item) return { ok: false, error: "unknown_item", itemId: l.itemId };
    const unit = unitPrice(item, l.treatment);
    if (unit == null) return { ok: false, error: "treatment_unavailable", itemId: l.itemId };
    if (!Number.isInteger(l.count) || l.count < 1) return { ok: false, error: "invalid_count", itemId: l.itemId };
    const lineUgx = unit * l.count;
    totalUgx += lineUgx;
    priced.push({ itemId: l.itemId, treatment: l.treatment, count: l.count, unitUgx: unit, lineUgx });
  }
  return { ok: true, totalUgx, priced };
}

/** Rounds to the nearest multiple of `step`. */
export const snap = (value: number, step: number) => Math.round(value / step) * step;

export type OfferBand = { minUgx: number; averageUgx: number; maxUgx: number; stepUgx: number };

/**
 * The slider range for an estimate-priced order, like a ride offer: the average
 * is the catalogue total, with a floor and a ceiling around it. All three sit on
 * the step so the slider lands on whole increments (500 by default).
 */
export function offerBand(catalogueUgx: number, minPercent: number, maxPercent: number, stepUgx: number): OfferBand {
  const step = Math.max(1, Math.round(stepUgx));
  const averageUgx = snap(catalogueUgx, step);
  const minUgx = Math.min(averageUgx, Math.max(step, snap((catalogueUgx * minPercent) / 100, step)));
  const maxUgx = Math.max(averageUgx, snap((catalogueUgx * maxPercent) / 100, step));
  return { minUgx, averageUgx, maxUgx, stepUgx: step };
}

/** Puts a requested offer on the step and inside the band. */
export function clampOffer(offerUgx: number, band: OfferBand): number {
  const onStep = snap(offerUgx, band.stepUgx);
  return Math.max(band.minUgx, Math.min(band.maxUgx, onStep));
}

/** What the goods cost: the admin catalogue price when prices are fixed, the clamped offer when they are estimates. */
export function goodsPrice(mode: "fixed" | "estimate", catalogueUgx: number, band: OfferBand, offerUgx?: number | null): number {
  if (mode === "fixed" || offerUgx == null) return mode === "fixed" ? catalogueUgx : band.averageUgx;
  return clampOffer(offerUgx, band);
}

export type RideFees = { pickupUgx: number; deliveryUgx: number };
export type RidePayers = { pickup: RidePayer; delivery: RidePayer };

/**
 * Splits both ride legs between customer and provider. "split" gives the
 * customer `customerSplitPercent` of that leg. The two shares of each leg
 * always add up to the leg's fee exactly.
 */
export function splitRides(fees: RideFees, payers: RidePayers, customerSplitPercent: number) {
  const leg = (fee: number, payer: RidePayer) => {
    const customer = payer === "customer" ? fee : payer === "provider" ? 0 : Math.round((fee * customerSplitPercent) / 100);
    return { customer, provider: fee - customer };
  };
  const pickup = leg(fees.pickupUgx, payers.pickup);
  const delivery = leg(fees.deliveryUgx, payers.delivery);
  return { pickup, delivery, customerUgx: pickup.customer + delivery.customer, providerUgx: pickup.provider + delivery.provider };
}

export type TipKind = "none" | "free" | "conditional";
export type TipRules = { freeEnabled: boolean; conditionalEnabled: boolean; maxUgx: number; stepUgx: number };

/** A tip the customer asked for, made valid under admin's rules. A kind that is switched off becomes no tip. */
export function normaliseTip(kind: TipKind, amountUgx: number, rules: TipRules): { kind: TipKind; amountUgx: number } {
  const allowed = (kind === "free" && rules.freeEnabled) || (kind === "conditional" && rules.conditionalEnabled);
  if (!allowed) return { kind: "none", amountUgx: 0 };
  const amount = Math.min(rules.maxUgx, snap(Math.max(0, amountUgx), rules.stepUgx));
  return amount > 0 ? { kind, amountUgx: amount } : { kind: "none", amountUgx: 0 };
}

/** A conditional tip is released only for a delivery inside the on-time window with no dispute. */
export function conditionalTipReleased(input: { disputed: boolean; deliveredAt: Date; promisedBy: Date }): boolean {
  return !input.disputed && input.deliveredAt.getTime() <= input.promisedBy.getTime();
}

/** Extra weight over the package limit, charged per lb. Never negative. */
export function overageUgx(weighedLb: number, limitLb: number, perLbUgx: number): number {
  return Math.round(Math.max(0, weighedLb - limitLb) * perLbUgx);
}
