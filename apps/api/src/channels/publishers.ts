import { db } from "../db/client.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { hasTable } from "../lib/schema.js";
import type { Row } from "./common.js";

/**
 * Who a post can be published as. One shared post model, many publishers: a creator's channel, a
 * plain account's personal profile, a store, a restaurant, a Learn school, a driver. Each module
 * keeps its own identity; this file only checks that the person really owns it and describes it.
 */
export const PUBLISHER_TYPES = ["channel", "personal", "store", "restaurant", "learn", "driver"] as const;
export type PublisherType = (typeof PUBLISHER_TYPES)[number];

export type PublisherInfo = {
  type: PublisherType;
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  verified: boolean;
  /** Where a viewer goes to see more from them. */
  href: string | null;
};

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

/** Everything this signed-in person may post as. */
export async function listIdentities(user: { sub: string; role: string }): Promise<PublisherInfo[]> {
  const env = await getPlatformEnvironment();
  const out: PublisherInfo[] = [];

  if (await hasTable("channels")) {
    const ch = (await db.execute({ sql: "SELECT * FROM channels WHERE owner_id = ? AND environment = ? AND status = 'active'", args: [user.sub, env] })).rows[0] as Row | undefined;
    if (ch) out.push(channelInfo(ch));
  }
  const me = (await db.execute({ sql: "SELECT id, name FROM users WHERE id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (me && user.role === "customer") out.push({ type: "personal", id: user.sub, name: String(me.name ?? "Me"), handle: null, avatarUrl: null, verified: false, href: null });

  for (const r of await safe(async () => (await db.execute({ sql: "SELECT id, name FROM restaurants WHERE owner_id = ? AND status = 'active' AND environment = ?", args: [user.sub, env] })).rows as Row[], [])) {
    out.push({ type: "restaurant", id: String(r.id), name: String(r.name), handle: null, avatarUrl: null, verified: false, href: `/restaurants/${r.id}` });
  }
  if (await hasTable("stores")) {
    for (const r of await safe(async () => (await db.execute({
      sql: `SELECT s.id, s.name, s.slug, s.logo_url FROM stores s JOIN merchant_members m ON m.merchant_id = s.merchant_id
            WHERE m.user_id = ? AND m.status = 'active' AND m.role IN ('owner', 'manager') AND s.status = 'active'`,
      args: [user.sub],
    })).rows as Row[], [])) {
      out.push({ type: "store", id: String(r.id), name: String(r.name), handle: null, avatarUrl: (r.logo_url as string) ?? null, verified: false, href: r.slug ? `/store/${r.slug}` : null });
    }
  }
  for (const r of await safe(async () => (await db.execute({ sql: "SELECT id, name FROM edu_schools WHERE owner_id = ? AND status = 'active'", args: [user.sub] })).rows as Row[], [])) {
    out.push({ type: "learn", id: String(r.id), name: String(r.name), handle: null, avatarUrl: null, verified: false, href: `/learn/schools/${r.id}` });
  }
  if (user.role === "rider" && me) {
    out.push({ type: "driver", id: user.sub, name: `${String(me.name ?? "Driver").split(" ")[0]} · Driver`, handle: null, avatarUrl: null, verified: false, href: null });
  }
  return out;
}

export function channelInfo(ch: Row): PublisherInfo {
  return {
    type: "channel",
    id: String(ch.id),
    name: String(ch.display_name),
    handle: String(ch.handle),
    avatarUrl: (ch.avatar_url as string) ?? null,
    verified: Number(ch.verified_badge) === 1,
    href: `/c/${ch.handle}`,
  };
}

/** The identity if (and only if) this person owns it. */
export async function resolveIdentity(user: { sub: string; role: string }, type: string, id: string): Promise<PublisherInfo | null> {
  if (!(PUBLISHER_TYPES as readonly string[]).includes(type)) return null;
  const all = await listIdentities(user);
  return all.find((p) => p.type === type && p.id === id) ?? null;
}

/** Display details for the publishers behind a page of posts, fetched together. */
export async function describePublishers(refs: Array<{ type: string; id: string }>): Promise<Map<string, PublisherInfo>> {
  const out = new Map<string, PublisherInfo>();
  const by = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!by.has(r.type)) by.set(r.type, new Set());
    by.get(r.type)!.add(r.id);
  }
  const key = (t: string, i: string) => `${t}:${i}`;
  const list = (s: Set<string>) => [...s];
  const marks = (s: Set<string>) => list(s).map(() => "?").join(",");

  const channels = by.get("channel");
  if (channels?.size) {
    for (const r of (await db.execute({ sql: `SELECT * FROM channels WHERE id IN (${marks(channels)})`, args: list(channels) })).rows as Row[]) out.set(key("channel", String(r.id)), channelInfo(r));
  }
  const personal = by.get("personal");
  if (personal?.size) {
    for (const r of (await db.execute({ sql: `SELECT id, name FROM users WHERE id IN (${marks(personal)})`, args: list(personal) })).rows as Row[]) {
      out.set(key("personal", String(r.id)), { type: "personal", id: String(r.id), name: String(r.name ?? "Peebee user"), handle: null, avatarUrl: null, verified: false, href: null });
    }
  }
  const restaurants = by.get("restaurant");
  if (restaurants?.size) {
    for (const r of await safe(async () => (await db.execute({ sql: `SELECT id, name FROM restaurants WHERE id IN (${marks(restaurants)})`, args: list(restaurants) })).rows as Row[], [])) {
      out.set(key("restaurant", String(r.id)), { type: "restaurant", id: String(r.id), name: String(r.name), handle: null, avatarUrl: null, verified: false, href: `/restaurants/${r.id}` });
    }
  }
  const stores = by.get("store");
  if (stores?.size) {
    for (const r of await safe(async () => (await db.execute({ sql: `SELECT id, name, slug, logo_url FROM stores WHERE id IN (${marks(stores)})`, args: list(stores) })).rows as Row[], [])) {
      out.set(key("store", String(r.id)), { type: "store", id: String(r.id), name: String(r.name), handle: null, avatarUrl: (r.logo_url as string) ?? null, verified: false, href: r.slug ? `/store/${r.slug}` : null });
    }
  }
  const schools = by.get("learn");
  if (schools?.size) {
    for (const r of await safe(async () => (await db.execute({ sql: `SELECT id, name FROM edu_schools WHERE id IN (${marks(schools)})`, args: list(schools) })).rows as Row[], [])) {
      out.set(key("learn", String(r.id)), { type: "learn", id: String(r.id), name: String(r.name), handle: null, avatarUrl: null, verified: false, href: `/learn/schools/${r.id}` });
    }
  }
  const drivers = by.get("driver");
  if (drivers?.size) {
    for (const r of (await db.execute({ sql: `SELECT id, name FROM users WHERE id IN (${marks(drivers)})`, args: list(drivers) })).rows as Row[]) {
      out.set(key("driver", String(r.id)), { type: "driver", id: String(r.id), name: `${String(r.name ?? "Driver").split(" ")[0]} · Driver`, handle: null, avatarUrl: null, verified: false, href: null });
    }
  }
  return out;
}

export const publisherKey = (type: string, id: string) => `${type}:${id}`;

/** True while a driver has a trip or delivery in progress. */
export async function driverOnJob(userId: string): Promise<boolean> {
  return safe(async () => {
    const res = await db.execute({
      sql: "SELECT 1 FROM orders WHERE rider_id = ? AND stage IN ('Match','Fund','Shop','Substitute','Approve','Deliver','Arrived','PickedUp','Handover') LIMIT 1",
      args: [userId],
    });
    return res.rows.length > 0;
  }, false);
}
