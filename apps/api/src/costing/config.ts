/**
 * Reading and saving the two JSON configs behind Admin → Pricing and Admin → Money flow. Reads merge what is stored
 * over the defaults, so an option added later takes its default instead of going missing.
 */
import {
  DEFAULT_MONEY_FLOW_CONFIG, DEFAULT_PRICING_CONFIG, DEFAULT_ROUNDING_RULE, FARE_SERVICES, MONEY_MODULES, normaliseRoundingRule, setRoundingRule,
  type MoneyFlowConfig, type PricingConfig, type RoundingRule,
} from "@peebee/shared";
import { z } from "zod";
import { getSetting, setSetting } from "../lib/settings.js";
import { mergeDefaults } from "../offers/config.js";

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const cfg = mergeDefaults(DEFAULT_PRICING_CONFIG, JSON.parse(await getSetting("pricing_config")));
    // The per-stop fee has always lived in the ride-extras setting; keep one source of truth.
    const legacyStop = Number(await getSetting("ride_stop_fee"));
    return Number.isFinite(legacyStop) ? { ...cfg, fees: { ...cfg.fees, stopFee: legacyStop } } : cfg;
  } catch {
    return DEFAULT_PRICING_CONFIG;
  }
}

/** The admin's rounding rule (Admin → Pricing → Rounding). */
export async function getRoundingConfig(): Promise<RoundingRule> {
  try {
    return normaliseRoundingRule(JSON.parse(await getSetting("rounding_config")));
  } catch {
    return DEFAULT_ROUNDING_RULE;
  }
}

/** Makes the admin's rounding rule the one every price, fee and discount in this request uses. Cheap: settings are cached. */
export async function applyRounding(): Promise<void> {
  setRoundingRule(await getRoundingConfig());
}

export const roundingSchema = z.object({
  enabled: z.boolean(),
  step: z.union([z.literal(500), z.literal(1000)]),
  roundUpAfter: z.number().int().min(0).max(999),
});

export async function getMoneyFlowConfig(): Promise<MoneyFlowConfig> {
  try {
    return mergeDefaults(DEFAULT_MONEY_FLOW_CONFIG, JSON.parse(await getSetting("money_flow_config")));
  } catch {
    return DEFAULT_MONEY_FLOW_CONFIG;
  }
}

const money = z.number().min(0).max(1_000_000_000);
const percent = z.number().min(0).max(100);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const windowSchema = z.object({ days: z.array(z.number().int().min(0).max(6)).max(7), from: hhmm, to: hhmm });
const zoneSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), radiusKm: z.number().min(0.1).max(500), label: z.string().trim().max(80) });
const match = z.enum(["pickup", "dropoff", "either"]);

const profileSchema = z.object({
  baseFare: money,
  bands: z.array(z.object({ fromKm: z.number().min(0).max(5000), ratePercent: z.number().min(1).max(500) })).max(12),
  perMinute: money,
  expectedSpeedKmh: z.number().min(5).max(200),
  distanceFactor: z.number().min(0.5).max(3),
  maximumFare: money,
});

export const pricingConfigSchema = z.object({
  profiles: z.object(Object.fromEntries(FARE_SERVICES.map((s) => [s, profileSchema])) as Record<(typeof FARE_SERVICES)[number], typeof profileSchema>),
  multipliers: z.object({
    fuel: z.object({ enabled: z.boolean(), percent: z.number().min(-50).max(300), perService: z.partialRecord(z.enum(FARE_SERVICES), z.number().min(-50).max(300)) }),
    peak: z.object({ enabled: z.boolean(), percent: z.number().min(-50).max(300), windows: z.array(windowSchema).max(14) }),
    night: z.object({ enabled: z.boolean(), percent: z.number().min(-50).max(300), windows: z.array(windowSchema).max(14) }),
    demand: z.object({ enabled: z.boolean(), levels: z.array(z.object({ ratio: z.number().min(1).max(100), percent: z.number().min(-50).max(300) })).max(10) }),
    traffic: z.object({ enabled: z.boolean(), active: z.boolean(), percent: z.number().min(-50).max(300) }),
    weather: z.object({ enabled: z.boolean(), active: z.boolean(), percent: z.number().min(-50).max(300) }),
    zone: z.object({ enabled: z.boolean(), zones: z.array(zoneSchema.extend({ percent: z.number().min(-50).max(300), match })).max(50) }),
    holiday: z.object({ enabled: z.boolean(), periods: z.array(z.object({ label: z.string().trim().max(60), from: monthDay, to: monthDay, percent: z.number().min(-50).max(300) })).max(30) }),
    combine: z.enum(["add", "multiply"]),
    maxMultiplier: z.number().min(1).max(10),
  }),
  fees: z.object({
    bookingFee: z.object({ enabled: z.boolean(), amount: money }),
    scheduledFee: z.object({ enabled: z.boolean(), amount: money }),
    stopFee: money,
    zoneFees: z.object({ enabled: z.boolean(), zones: z.array(zoneSchema.extend({ amount: money, match })).max(50) }),
    returnTripDiscountPercent: percent,
  }),
  tzOffsetMinutes: z.number().int().min(-720).max(840),
});

const commissionSchema = z.object({
  type: z.enum(["percent", "flat", "percent_min_max", "tiered"]),
  percent,
  flat: money,
  min: money,
  max: money,
  tiers: z.array(z.object({ fromAmount: money, percent })).max(10),
  base: z.enum(["gross", "fare_only"]),
});
const bearer = z.enum(["customer", "platform", "provider", "split"]);
const modules = z.enum(MONEY_MODULES);

export const moneyFlowConfigSchema = z.object({
  modules: z.object(Object.fromEntries(MONEY_MODULES.map((m) => [m, z.object({ commission: commissionSchema, gatewayFeeBearer: bearer, gatewayFeeCustomerPercent: percent, taxed: z.boolean() })])) as Record<(typeof MONEY_MODULES)[number], z.ZodObject<{ commission: typeof commissionSchema; gatewayFeeBearer: typeof bearer; gatewayFeeCustomerPercent: typeof percent; taxed: z.ZodBoolean }>>),
  providerFees: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    provider: z.string().trim().min(1).max(30).regex(/^[a-z0-9_-]+$/),
    direction: z.enum(["collection", "disbursement"]),
    network: z.enum(["any", "mtn", "airtel", "card"]),
    type: z.enum(["percent", "flat", "percent_plus_flat"]),
    percent: z.number().min(0).max(50),
    flat: money,
    min: money,
    max: money,
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    enabled: z.boolean(),
  })).max(100),
  taxes: z.array(z.object({
    id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
    name: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    percent: z.number().min(0).max(100),
    appliesTo: z.enum(["commission", "gateway_fee", "gross", "provider_payout"]),
    mode: z.enum(["on_top", "inclusive"]),
    bearer: z.enum(["platform", "provider"]),
    modules: z.array(modules).max(20),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).max(20),
  maintenance: z.object({ enabled: z.boolean(), percent, of: z.enum(["platform_net", "gross"]) }),
});

export const costingKinds = {
  pricing: { key: "pricing_config" as const, schema: pricingConfigSchema, load: getPricingConfig },
  moneyFlow: { key: "money_flow_config" as const, schema: moneyFlowConfigSchema, load: getMoneyFlowConfig },
};
export type CostingKind = keyof typeof costingKinds;

export async function saveCostingConfig(kind: CostingKind, value: unknown): Promise<{ ok: true; value: unknown } | { ok: false; issues: z.ZodIssue[] }> {
  const def = costingKinds[kind];
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  await setSetting(def.key, JSON.stringify(parsed.data));
  return { ok: true, value: parsed.data };
}
