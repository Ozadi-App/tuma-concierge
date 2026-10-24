import { getSetting, setSetting } from "../lib/settings.js";
import { RIDE_PAYERS, snap, type RidePayer } from "./laundry-pricing.js";

/**
 * Laundry behaviour is controlled from Admin: how each service is priced, the offer
 * slider's band and step, who pays each rider leg, tips and extra-weight pricing.
 * Nothing here is a constant in code beyond structural safety rails.
 */

export const LAUNDRY_SERVICES = ["wash_fold", "dry_clean", "iron", "custom"] as const;
export type LaundryService = (typeof LAUNDRY_SERVICES)[number];
export type LaundryPricingMode = "fixed" | "estimate";

export type LaundrySettings = {
  /** Per service: admin prices override ("fixed") or the customer may offer a price ("estimate"). */
  pricing: Record<LaundryService, LaundryPricingMode>;
  offerMinPercent: number;
  offerMaxPercent: number;
  /** Slider increment in UGX; always a multiple of 500. */
  offerStepUgx: number;
  ridePayerPickup: RidePayer;
  ridePayerDelivery: RidePayer;
  rideSplitCustomerPercent: number;
  rideFeeUgx: number;
  overageUgxPerLb: number;
  tipFreeEnabled: boolean;
  tipConditionalEnabled: boolean;
  tipMaxUgx: number;
  tipOntimeHours: number;
  /** Peebee's percent of the goods, withheld from the provider's payout. */
  providerCommissionPercent: number;
  customerFeeEnabled: boolean;
  customerFeeType: "flat" | "percent";
  /** UGX when flat, percent of goods plus rides when percent. */
  customerFeeValue: number;
  customerFeeMaxSharePercent: number;
};

const int = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};
const payer = (raw: string | undefined, fallback: RidePayer): RidePayer => ((RIDE_PAYERS as readonly string[]).includes(raw ?? "") ? (raw as RidePayer) : fallback);
const mode = (raw: string | undefined): LaundryPricingMode => (raw === "estimate" ? "estimate" : "fixed");

export async function getLaundrySettings(): Promise<LaundrySettings> {
  const keys = [
    "laundry_pricing_wash_fold", "laundry_pricing_dry_clean", "laundry_pricing_iron", "laundry_pricing_custom",
    "laundry_offer_min_percent", "laundry_offer_max_percent", "laundry_offer_step_ugx",
    "laundry_ride_payer_pickup", "laundry_ride_payer_delivery", "laundry_ride_split_customer_percent", "laundry_ride_fee_ugx",
    "laundry_overage_ugx_per_lb", "laundry_tip_free_enabled", "laundry_tip_conditional_enabled", "laundry_tip_max_ugx", "laundry_tip_ontime_hours",
    "laundry_provider_commission_percent", "laundry_customer_fee_enabled", "laundry_customer_fee_type", "laundry_customer_fee_value", "laundry_customer_fee_max_share_percent",
  ] as const;
  const v = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)]))) as Record<(typeof keys)[number], string>;
  const minPercent = int(v.laundry_offer_min_percent, 80, 1, 100);
  return {
    pricing: { wash_fold: mode(v.laundry_pricing_wash_fold), dry_clean: mode(v.laundry_pricing_dry_clean), iron: mode(v.laundry_pricing_iron), custom: mode(v.laundry_pricing_custom) },
    offerMinPercent: minPercent,
    // The ceiling is never below the floor.
    offerMaxPercent: Math.max(100, int(v.laundry_offer_max_percent, 130, 100, 500)),
    offerStepUgx: Math.max(500, snap(int(v.laundry_offer_step_ugx, 500, 500, 50_000), 500)),
    ridePayerPickup: payer(v.laundry_ride_payer_pickup, "customer"),
    ridePayerDelivery: payer(v.laundry_ride_payer_delivery, "provider"),
    rideSplitCustomerPercent: int(v.laundry_ride_split_customer_percent, 50, 0, 100),
    rideFeeUgx: int(v.laundry_ride_fee_ugx, 0, 0, 1_000_000),
    overageUgxPerLb: int(v.laundry_overage_ugx_per_lb, 0, 0, 1_000_000),
    tipFreeEnabled: v.laundry_tip_free_enabled !== "0",
    tipConditionalEnabled: v.laundry_tip_conditional_enabled !== "0",
    tipMaxUgx: int(v.laundry_tip_max_ugx, 50_000, 0, 10_000_000),
    tipOntimeHours: int(v.laundry_tip_ontime_hours, 48, 1, 24 * 30),
    providerCommissionPercent: int(v.laundry_provider_commission_percent, 15, 0, 60),
    customerFeeEnabled: v.laundry_customer_fee_enabled === "1",
    customerFeeType: v.laundry_customer_fee_type === "percent" ? "percent" : "flat",
    customerFeeValue: int(v.laundry_customer_fee_value, 0, 0, 10_000_000),
    customerFeeMaxSharePercent: int(v.laundry_customer_fee_max_share_percent, 50, 1, 99),
  };
}

export async function setLaundrySettings(next: Partial<Omit<LaundrySettings, "pricing">> & { pricing?: Partial<LaundrySettings["pricing"]> }): Promise<void> {
  const writes: Promise<void>[] = [];
  const put = (key: Parameters<typeof setSetting>[0], value: string) => writes.push(setSetting(key, value));
  if (next.pricing?.wash_fold) put("laundry_pricing_wash_fold", next.pricing.wash_fold);
  if (next.pricing?.dry_clean) put("laundry_pricing_dry_clean", next.pricing.dry_clean);
  if (next.pricing?.iron) put("laundry_pricing_iron", next.pricing.iron);
  if (next.pricing?.custom) put("laundry_pricing_custom", next.pricing.custom);
  if (next.offerMinPercent != null) put("laundry_offer_min_percent", String(next.offerMinPercent));
  if (next.offerMaxPercent != null) put("laundry_offer_max_percent", String(next.offerMaxPercent));
  if (next.offerStepUgx != null) put("laundry_offer_step_ugx", String(next.offerStepUgx));
  if (next.ridePayerPickup) put("laundry_ride_payer_pickup", next.ridePayerPickup);
  if (next.ridePayerDelivery) put("laundry_ride_payer_delivery", next.ridePayerDelivery);
  if (next.rideSplitCustomerPercent != null) put("laundry_ride_split_customer_percent", String(next.rideSplitCustomerPercent));
  if (next.rideFeeUgx != null) put("laundry_ride_fee_ugx", String(next.rideFeeUgx));
  if (next.overageUgxPerLb != null) put("laundry_overage_ugx_per_lb", String(next.overageUgxPerLb));
  if (next.tipFreeEnabled != null) put("laundry_tip_free_enabled", next.tipFreeEnabled ? "1" : "0");
  if (next.tipConditionalEnabled != null) put("laundry_tip_conditional_enabled", next.tipConditionalEnabled ? "1" : "0");
  if (next.tipMaxUgx != null) put("laundry_tip_max_ugx", String(next.tipMaxUgx));
  if (next.tipOntimeHours != null) put("laundry_tip_ontime_hours", String(next.tipOntimeHours));
  if (next.providerCommissionPercent != null) put("laundry_provider_commission_percent", String(next.providerCommissionPercent));
  if (next.customerFeeEnabled != null) put("laundry_customer_fee_enabled", next.customerFeeEnabled ? "1" : "0");
  if (next.customerFeeType) put("laundry_customer_fee_type", next.customerFeeType);
  if (next.customerFeeValue != null) put("laundry_customer_fee_value", String(next.customerFeeValue));
  if (next.customerFeeMaxSharePercent != null) put("laundry_customer_fee_max_share_percent", String(next.customerFeeMaxSharePercent));
  await Promise.all(writes);
}
