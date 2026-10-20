/** Pure helpers for the Hive home (map + "What needs doing?" sheet). */

export type HiveTrade = "clean" | "laundry" | "fix";
type PriceSource = { type: HiveTrade; pricingMode: "fixed" | "quote"; unitPriceUgx: number; calloutFeeUgx: number; unitLabel: string };
export type TradePrice = { kind: "from"; ugx: number; unit: string } | { kind: "quote"; calloutUgx: number } | null;

/** The cheapest fixed price for a trade ("from 5,000 / kg"), or, when everything is quoted, the lowest call-out fee. */
export function tradePrice(services: PriceSource[], type: HiveTrade): TradePrice {
  const list = services.filter((s) => s.type === type);
  const fixed = list.filter((s) => s.pricingMode === "fixed" && s.unitPriceUgx > 0).sort((a, b) => a.unitPriceUgx - b.unitPriceUgx);
  if (fixed[0]) return { kind: "from", ugx: fixed[0].unitPriceUgx, unit: fixed[0].unitLabel || "job" };
  const quotes = list.filter((s) => s.pricingMode === "quote").sort((a, b) => a.calloutFeeUgx - b.calloutFeeUgx);
  return quotes[0] ? { kind: "quote", calloutUgx: quotes[0].calloutFeeUgx } : null;
}

export function shortUgx(ugx: number): string {
  if (ugx >= 1000 && ugx % 1000 === 0) return `${ugx / 1000}k`;
  if (ugx >= 1000) return `${(ugx / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(ugx);
}

export function tradePriceLabel(p: TradePrice): string {
  if (!p) return "See prices";
  if (p.kind === "from") return `from ${shortUgx(p.ugx)} / ${p.unit}`;
  return p.calloutUgx > 0 ? `Quote · ${shortUgx(p.calloutUgx)} call-out` : "Free quote";
}

const LIVE = ["in_progress", "booked", "quoted", "completed", "assigned", "open", "disputed"];
/** The job worth surfacing on the Hive home: the furthest-along active one, newest first within a status. */
export function activeHiveJob<T extends { status: string; createdAt: string }>(jobs: T[]): T | null {
  const active = jobs.filter((j) => LIVE.includes(j.status));
  active.sort((a, b) => LIVE.indexOf(a.status) - LIVE.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt));
  return active[0] ?? null;
}

export type Matching = "broadcast" | "customer_picks" | "admin_assigns";
export const MATCHING_LABEL: Record<Matching, string> = { broadcast: "First to accept", customer_picks: "Offers", admin_assigns: "Peebee assigns" };

/** Where "Next" takes the customer: the trade's booking page with the sheet's choices carried over. */
export function bookingHref(base: string, opts: { matching?: Matching | null; when: "now" | "later"; at?: string | null }): string {
  const q = new URLSearchParams();
  if (opts.matching) q.set("matching", opts.matching);
  if (opts.when === "later") {
    q.set("when", "later");
    if (opts.at) q.set("at", opts.at);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** "9 cleaners nearby" style headline from the nearby counts. */
export function nearbyHeadline(counts: Record<HiveTrade, number> | null, enabled: HiveTrade[]): string | null {
  if (!counts) return null;
  const total = enabled.reduce((n, t) => n + (counts[t] ?? 0), 0);
  if (total === 0) return null;
  return `${total} provider${total === 1 ? "" : "s"} online near you`;
}

export type SchedulePreset = { id: string; label: string; at: string };
/** "In 30 min", "In 1 hour", "In 3 hours", "In 1 h 30 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `In ${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (m === 0) return h === 1 ? "In 1 hour" : `In ${h} hours`;
  return `In ${h} h ${m} min`;
}

export type ScheduleRules = {
  minLeadMinutes: number;
  maxAdvanceDays: number;
  scheduleQuickMinutes?: number[];
  scheduleTomorrowEnabled?: boolean;
  scheduleTomorrowTime?: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Local `YYYY-MM-DDTHH:mm`, the format a datetime-local input uses. */
export function localInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "9:00 am" from "09:00". */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${pad2(m ?? 0)} ${(h ?? 0) < 12 ? "am" : "pm"}`;
}

/** The quick "when" choices for a booking: N minutes from now (rounded up to 5 minutes) and tomorrow, the following day, at the admin's time.
 * Only choices inside the booking window (minimum lead, days ahead) are offered. Defaults apply when the API doesn't send the settings. */
export function schedulePresets(rules: ScheduleRules, now: Date = new Date()): SchedulePreset[] {
  const inside = (t: Date) => {
    const lead = (t.getTime() - now.getTime()) / 60_000;
    return lead >= rules.minLeadMinutes && lead <= rules.maxAdvanceDays * 1440;
  };
  const out: SchedulePreset[] = [];
  for (const m of rules.scheduleQuickMinutes ?? [60, 180]) {
    const t = new Date(now.getTime() + m * 60_000);
    t.setSeconds(0, 0);
    t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5);
    if (inside(t)) out.push({ id: `in-${m}`, label: durationLabel(m), at: localInput(t) });
  }
  if (rules.scheduleTomorrowEnabled ?? true) {
    const time = rules.scheduleTomorrowTime ?? "09:00";
    const [hh, mm] = time.split(":").map(Number);
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(hh ?? 9, mm ?? 0, 0, 0);
    if (inside(t)) out.push({ id: "tomorrow", label: `Tomorrow ${clockLabel(time)}`, at: localInput(t) });
  }
  return out;
}
