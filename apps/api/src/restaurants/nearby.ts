/**
 * GET /v1/food/nearby-items — dishes from open, food-enabled businesses near
 * the customer, for the Eat home. Bounding box in SQL first, then a straight-
 * line haversine check. Without lat/lng it returns open businesses' dishes
 * (featured first) with no distance, so the app can still show something.
 */
import { Hono } from "hono";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { consume, tooManyRequests } from "../lib/ratelimit.js";
import { getPlatformEnvironment, isServiceEnabled } from "../lib/settings.js";
import { DEMO_FOOD_RESTAURANTS, demoFoodMenu, demoFoodRestaurant } from "@peebee/shared/demo-food";
import { reconcileFoodHours } from "./hours.js";

export const nearbyFoodRoutes = new Hono();

type Row = Record<string, unknown>;

export interface NearbyItem {
  id: string; restaurantId: string; restaurantName: string; businessType: string;
  name: string; description: string | null; price: number; from: boolean;
  photoKey: string | null; updatedAt: string | null; isFeatured: boolean;
  prepTimeMinutes: number | null; badge: string | null; categoryName: string | null;
  distanceKm: number | null; isDemo: boolean;
}

const MAX_ITEMS = 60;
const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseNearbyQuery(q: Record<string, string | undefined>) {
  const lat = num(q.lat), lng = num(q.lng);
  const located = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const r = num(q.radiusKm);
  const radiusKm = Math.min(25, Math.max(0.5, r ?? 5));
  const term = (q.q ?? "").trim().slice(0, 60).toLowerCase();
  return { lat: located ? lat : null, lng: located ? lng : null, located, radiusKm, term };
}

export function sortNearby(items: NearbyItem[]): NearbyItem[] {
  return [...items].sort((a, b) =>
    Number(b.isFeatured) - Number(a.isFeatured)
    || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    || a.name.localeCompare(b.name));
}

nearbyFoodRoutes.get("/food/nearby-items", requireAuth, async (c) => {
  const user = c.get("user");
  const limit = await consume(`food:nearby:${user.sub}`, 60, 60);
  if (!limit.allowed) return tooManyRequests(c, limit, "Too many searches. Try again in a moment.");
  const { lat, lng, located, radiusKm, term } = parseNearbyQuery(c.req.query());
  if (!(await isServiceEnabled("food"))) return c.json({ items: [], located, radiusKm, paused: true });
  const environment = await getPlatformEnvironment();

  let sql = "SELECT * FROM restaurants WHERE status = 'active' AND environment = ?";
  const args: (string | number)[] = [environment];
  if (located) {
    const dLat = radiusKm / 111.32;
    const dLng = radiusKm / (111.32 * Math.max(0.01, Math.cos((lat! * Math.PI) / 180)));
    sql += " AND lat IS NOT NULL AND lng IS NOT NULL AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?";
    args.push(lat! - dLat, lat! + dLat, lng! - dLng, lng! + dLng);
  }
  const res = await db.execute({ sql, args });
  let restaurants: Row[] = await Promise.all((res.rows as Row[]).map((row) => reconcileFoodHours(row)));
  if (environment === "sandbox") {
    restaurants = [...restaurants.filter((r) => !demoFoodRestaurant(String(r.id))), ...(DEMO_FOOD_RESTAURANTS as unknown as Row[])];
  }
  const distance = new Map<string, number | null>();
  restaurants = restaurants.filter((r) => {
    if (!Number(r.is_open)) return false;
    if (!located) { distance.set(String(r.id), null); return true; }
    if (typeof r.lat !== "number" || typeof r.lng !== "number") return false;
    const km = haversineKm(lat!, lng!, r.lat, r.lng);
    if (km > radiusKm) return false;
    distance.set(String(r.id), Math.round(km * 10) / 10);
    return true;
  });

  const items: NearbyItem[] = [];
  const base = (r: Row) => ({ restaurantId: String(r.id), restaurantName: String(r.name), businessType: String(r.business_type ?? "restaurant"), distanceKm: distance.get(String(r.id)) ?? null });
  const matches = (name: string, cat: string | null) => !term || name.toLowerCase().includes(term) || (cat ?? "").toLowerCase().includes(term);

  const real = restaurants.filter((r) => !(environment === "sandbox" && demoFoodRestaurant(String(r.id))));
  for (const r of restaurants) {
    if (real.includes(r)) continue;
    const menu = demoFoodMenu(String(r.id));
    for (const cat of menu?.categories ?? []) for (const it of cat.items) {
      if (!it.available || !matches(it.name, cat.name)) continue;
      items.push({ ...base(r), id: it.id, name: it.name, description: it.description ?? null, price: Number(it.price),
        from: (it.options ?? []).some((o) => o.required), photoKey: it.photo_key ?? null, updatedAt: it.updated_at ?? null,
        isFeatured: !!it.is_featured, prepTimeMinutes: it.prep_time_minutes ?? null, badge: it.badge ?? null,
        categoryName: cat.name, distanceKm: base(r).distanceKm, isDemo: true });
    }
  }
  const byId = new Map(real.map((r) => [String(r.id), r]));
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const marks = chunk.map(() => "?").join(",");
    const rows = await db.execute({
      sql: `SELECT i.*, cat.name AS category_name,
              EXISTS(SELECT 1 FROM menu_item_options o WHERE o.menu_item_id = i.id AND o.required = 1) AS has_required
            FROM menu_items i LEFT JOIN menu_categories cat ON cat.id = i.category_id
            WHERE i.available = 1 AND i.restaurant_id IN (${marks})`,
      args: chunk,
    });
    for (const it of rows.rows as Row[]) {
      const r = byId.get(String(it.restaurant_id));
      const cat = (it.category_name as string | null) ?? null;
      if (!r || !matches(String(it.name), cat)) continue;
      items.push({ ...base(r), id: String(it.id), name: String(it.name), description: (it.description as string | null) ?? null,
        price: Number(it.price), from: !!Number(it.has_required), photoKey: (it.photo_key as string | null) ?? null,
        updatedAt: (it.updated_at as string | null) ?? null, isFeatured: !!Number(it.is_featured ?? 0),
        prepTimeMinutes: it.prep_time_minutes == null ? null : Number(it.prep_time_minutes), badge: (it.badge as string | null) ?? null,
        categoryName: cat, distanceKm: base(r).distanceKm, isDemo: false });
    }
  }
  return c.json({ items: sortNearby(items).slice(0, MAX_ITEMS), located, radiusKm });
});
