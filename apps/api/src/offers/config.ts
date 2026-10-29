/**
 * Reading and saving the four JSON configs behind Admin → Offers. Reads merge what is stored over the recommended
 * defaults, so an option added later is on (or off) by its default instead of missing; saves are validated whole.
 */
import {
  mergeDefaults, CREDIT_MODULES, DEFAULT_CREDIT_CONFIG, DEFAULT_DISCOUNT_WALLET_CONFIG, DEFAULT_INCENTIVE_CONFIG, DEFAULT_OFFERS_CONFIG, OFFER_SERVICES,
  type CreditConfig, type DiscountWalletConfig, type IncentiveConfig, type OffersConfig,
} from "@peebee/shared";
import { z } from "zod";
import { getSetting, setSetting } from "../lib/settings.js";

export { mergeDefaults };

async function load<T>(key: "offers_config" | "discount_wallet_config" | "incentives_config" | "credit_config", defaults: T): Promise<T> {
  try {
    return mergeDefaults(defaults, JSON.parse(await getSetting(key)));
  } catch {
    return defaults;
  }
}

export const getOffersConfig = () => load<OffersConfig>("offers_config", DEFAULT_OFFERS_CONFIG);
export const getDiscountWalletConfig = () => load<DiscountWalletConfig>("discount_wallet_config", DEFAULT_DISCOUNT_WALLET_CONFIG);
export const getIncentiveConfig = () => load<IncentiveConfig>("incentives_config", DEFAULT_INCENTIVE_CONFIG);
export const getCreditConfig = () => load<CreditConfig>("credit_config", DEFAULT_CREDIT_CONFIG);

const money = z.number().int().min(0).max(1_000_000_000);
const percent = z.number().min(0).max(100);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const windowSchema = z.object({ days: z.array(z.number().int().min(0).max(6)).max(7), from: hhmm, to: hhmm });
const zoneSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), radiusKm: z.number().min(0.1).max(500), label: z.string().trim().max(80) });
const amountRule = z.object({ type: z.enum(["flat", "percent"]), value: z.number().min(0).max(1_000_000_000), maxPerRide: money });
const boolRecord = <K extends string>(keys: readonly K[]) => z.object(Object.fromEntries(keys.map((k) => [k, z.boolean()])) as Record<K, z.ZodBoolean>);

export const offersConfigSchema = z.object({
  enabled: z.boolean(),
  stacking: z.object({ mode: z.enum(["best_one", "stack"]), maxDiscountPercent: z.number().min(1).max(100) }),
  services: boolRecord(OFFER_SERVICES),
  allowCodeEntry: z.boolean(),
  showSavings: z.boolean(),
  tzOffsetMinutes: z.number().int().min(-720).max(840),
  loyaltyTiers: z.array(z.object({ id: z.string().trim().min(1).max(30).regex(/^[a-z0-9_-]+$/), label: z.string().trim().min(1).max(40), minRides: money })).min(1).max(10),
  packsPurchasable: z.boolean(),
  referral: z.object({ enabled: z.boolean(), referrerCreditUgx: money }),
});

export const discountWalletConfigSchema = z.object({
  enabled: z.boolean(),
  vehicles: boolRecord(["boda", "car", "delivery"] as const),
  accrual: z.enum(["below_minimum", "full_discount", "none"]),
  offsetCommission: z.boolean(),
  offsetMaxPercent: z.number().min(1).max(100),
  payoutMethod: z.enum(["active_wallet", "mobile_money", "none"]),
  payoutTrigger: z.enum(["daily", "weekly", "after_days", "threshold", "on_request"]),
  payoutWeekday: z.number().int().min(0).max(6),
  payoutAfterDays: z.number().int().min(0).max(365),
  payoutThreshold: money,
  minPayout: money,
  maxBalance: money,
  expiryDays: z.number().int().min(0).max(3650),
  riderCanRequest: z.boolean(),
});

const kindEnabled = { enabled: z.boolean() };
export const incentiveConfigSchema = z.object({
  enabled: z.boolean(),
  monthlyBudget: money,
  vehicles: boolRecord(["boda", "car", "delivery"] as const),
  tzOffsetMinutes: z.number().int().min(-720).max(840),
  kinds: z.object({
    trip_streak: z.object({ ...kindEnabled, rides: z.number().int().min(1).max(500), bonus: money, noCancelRequired: z.boolean() }),
    weekly_ladder: z.object({ ...kindEnabled, tiers: z.array(z.object({ rides: z.number().int().min(1).max(5000), bonus: money })).max(12) }),
    peak_boost: z.object({ ...kindEnabled, windows: z.array(windowSchema).max(14), rule: amountRule }),
    zone_boost: z.object({ ...kindEnabled, zones: z.array(zoneSchema).max(50), rule: amountRule }),
    reliability_bonus: z.object({ ...kindEnabled, minRides: z.number().int().min(1).max(5000), minCompletionPercent: percent, maxCancelPercent: percent, bonus: money }),
    rating_bonus: z.object({ ...kindEnabled, minRating: z.number().min(1).max(5), minRatings: z.number().int().min(1).max(5000), bonus: money }),
    rider_referral: z.object({ ...kindEnabled, afterRides: z.number().int().min(1).max(5000), bonus: money }),
    commission_holiday: z.object({ ...kindEnabled, firstDays: z.number().int().min(0).max(365), firstRides: z.number().int().min(0).max(100_000), waivePercent: percent }),
    commission_tiers: z.object({ ...kindEnabled, tiers: z.array(z.object({ ridesPerMonth: z.number().int().min(0).max(100_000), percent })).max(10) }),
    online_hours: z.object({ ...kindEnabled, windows: z.array(windowSchema).max(14), hoursPerWeek: z.number().min(1).max(168), bonus: money }),
    long_pickup: z.object({ ...kindEnabled, thresholdKm: z.number().min(0).max(100), perKm: money, maxAmount: money }),
    night_bonus: z.object({ ...kindEnabled, windows: z.array(windowSchema).max(14), rule: amountRule }),
    fuel_support: z.object({ ...kindEnabled, weeklyRides: z.number().int().min(1).max(5000), credit: money }),
    milestones: z.object({ ...kindEnabled, milestones: z.array(z.object({ rides: z.number().int().min(1).max(1_000_000), bonus: money })).max(20) }),
    leaderboard: z.object({ ...kindEnabled, period: z.enum(["week", "month"]), minRides: z.number().int().min(1).max(5000), prizes: z.array(money).max(20) }),
    welcome_back: z.object({ ...kindEnabled, inactiveDays: z.number().int().min(1).max(365), afterRides: z.number().int().min(1).max(100), bonus: money }),
  }),
});

const isoOrNull = z.string().datetime({ offset: true }).nullable();
export const creditConfigSchema = z.object({
  enabled: z.boolean(),
  spendOrder: z.enum(["credit_first", "cash_first"]),
  expiryDays: z.number().int().min(0).max(3650),
  spendableModules: boolRecord(CREDIT_MODULES),
  maxSharePercent: z.number().min(1).max(100),
  partnerIds: z.array(z.string().trim().min(1).max(80)).max(500),
  partnerCreditLocked: z.boolean(),
  topup: z.object({
    feeMode: z.enum(["customer_pays", "make_whole"]),
    makeWholeIncludesTax: z.boolean(),
    makeWholeMinTopup: money,
    makeWholeMonthlyCapPerCustomer: money,
    makeWholeMonthlyBudget: money,
    bonus: z.object({
      enabled: z.boolean(),
      type: z.enum(["flat", "percent"]),
      value: z.number().min(0).max(1_000_000_000),
      minDeposit: money,
      maxBonusPerDeposit: money,
      maxBonusPerMonth: money,
      firstDepositOnly: z.boolean(),
      requireVerified: z.boolean(),
      maxBonusDepositsPerDay: z.number().int().min(0).max(100),
      startsAt: isoOrNull,
      endsAt: isoOrNull,
    }),
  }),
  withdrawal: z.object({
    enabled: z.boolean(),
    lockDays: z.number().int().min(0).max(365),
    maxPercentPerRequest: z.number().min(1).max(100),
    minAmount: money,
    dailyLimit: money,
    keepMinimum: money,
    oneBonusPerPhone: z.boolean(),
    reviewIfWithinDays: z.number().int().min(0).max(365),
    clawbackOnReversal: z.boolean(),
  }),
});

export const configKinds = {
  offers: { key: "offers_config", schema: offersConfigSchema, load: getOffersConfig },
  discountWallet: { key: "discount_wallet_config", schema: discountWalletConfigSchema, load: getDiscountWalletConfig },
  incentives: { key: "incentives_config", schema: incentiveConfigSchema, load: getIncentiveConfig },
  credit: { key: "credit_config", schema: creditConfigSchema, load: getCreditConfig },
} as const;
export type ConfigKind = keyof typeof configKinds;

export async function saveConfig(kind: ConfigKind, value: unknown): Promise<{ ok: true; value: unknown } | { ok: false; issues: z.ZodIssue[] }> {
  const def = configKinds[kind];
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  await setSetting(def.key, JSON.stringify(parsed.data));
  return { ok: true, value: parsed.data };
}
