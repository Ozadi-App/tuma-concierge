import type { Context } from "hono";
import type { ChannelsConfig } from "@peebee/shared";
import { hasTable } from "../lib/schema.js";
import { getChannelsConfig } from "./settings.js";

export type Row = Record<string, unknown>;

export type HttpStatus = 400 | 401 | 402 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 502 | 503;

/** A refusal whose message is safe to show a person. */
export class ChannelsError extends Error {
  constructor(readonly code: string, readonly clientMessage: string, readonly status: HttpStatus = 400, readonly extra?: Record<string, unknown>) {
    super(code);
    this.name = "ChannelsError";
  }
}

export function fail(c: Context, err: unknown) {
  if (err instanceof ChannelsError) return c.json({ error: err.code, message: err.clientMessage, ...(err.extra ?? {}) }, err.status);
  console.error("channels error:", err);
  return c.json({ error: "channels_failed", message: "Something went wrong. Please try again." }, 500);
}

export async function channelsReady(): Promise<boolean> {
  return (await hasTable("channels")) && (await hasTable("posts"));
}

/** The config, once the feature is on and its tables exist. Throws a plain "unavailable" otherwise. */
export async function requireChannels(): Promise<ChannelsConfig> {
  const cfg = await getChannelsConfig();
  if (!cfg.enabled || !(await channelsReady())) throw new ChannelsError("channels_unavailable", "Channels are not available yet.", 503);
  return cfg;
}

/** The ready check for money features: their own master switch on top of Channels being on. */
export async function requireMoney(feature?: "memberships" | "payPerView" | "tips" | "gifts"): Promise<ChannelsConfig> {
  const cfg = await requireChannels();
  if (!cfg.monetization.enabled || (feature && !cfg.monetization[feature])) throw new ChannelsError("money_unavailable", "This is not available yet.", 503);
  for (const t of ["creator_balances", "creator_earnings"] as const) {
    if (!(await hasTable(t))) throw new ChannelsError("money_unavailable", "This is not available yet.", 503);
  }
  return cfg;
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** SQLite datetime('now') text for a JS date. */
export const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export function ugx(n: number): string {
  return `UGX ${Math.round(n).toLocaleString("en-US")}`;
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Public media addresses are stored as paths; clients get absolute ones. */
export function absUrl(origin: string, value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("/") ? `${origin}${value}` : value;
}
