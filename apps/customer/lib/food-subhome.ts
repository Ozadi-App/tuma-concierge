import type { FoodBusinessType, MenuItem, Restaurant, RestaurantMenu } from "@peebee/shared";

/** A dish on a sub home, with the business it comes from. */
export type SubHomeDish = { item: MenuItem; restaurant: Restaurant };

export const businessTypeOf = (r: Pick<Restaurant, "business_type">): FoodBusinessType => (r.business_type ?? "restaurant") as FoodBusinessType;

/** Every orderable dish of these businesses (open ones first, then by name order the menu gives). */
export function collectDishes(businesses: Restaurant[], menus: Record<string, RestaurantMenu | undefined>): SubHomeDish[] {
  const out: SubHomeDish[] = [];
  const ordered = [...businesses].sort((a, b) => Number(!!b.is_open) - Number(!!a.is_open));
  for (const restaurant of ordered) {
    const menu = menus[restaurant.id];
    if (!menu) continue;
    const items = [...menu.categories.flatMap((c) => c.items), ...menu.uncategorizedItems];
    for (const item of items) if (item.available === 1) out.push({ item, restaurant });
  }
  return out;
}

export const featuredDishes = (dishes: SubHomeDish[]) => dishes.filter((d) => d.item.is_featured === 1);
export const quickDishes = (dishes: SubHomeDish[], maxMinutes: number) =>
  dishes.filter((d) => d.item.prep_time_minutes != null && d.item.prep_time_minutes > 0 && d.item.prep_time_minutes <= maxMinutes);
export const dishesUnder = (dishes: SubHomeDish[], ugx: number) => dishes.filter((d) => d.item.price <= ugx);

/** Cuisine words the businesses themselves use ("Pizza · Italian"), most common first. */
export function cuisineTags(businesses: Restaurant[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const b of businesses) {
    for (const raw of (b.cuisine ?? "").split(/[·,/]/)) {
      const tag = raw.trim();
      if (tag && !/^street food$/i.test(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([t]) => t);
}

/** Menu sections across these businesses, each with a dish to picture it. */
export function menuSections(businesses: Restaurant[], menus: Record<string, RestaurantMenu | undefined>, limit = 5) {
  const seen = new Map<string, { name: string; restaurantId: string; item: MenuItem | null; count: number }>();
  for (const b of businesses) {
    for (const c of menus[b.id]?.categories ?? []) {
      const key = c.name.trim().toLowerCase();
      const items = c.items.filter((i) => i.available === 1);
      if (!items.length) continue;
      const prev = seen.get(key);
      if (prev) prev.count += items.length;
      else seen.set(key, { name: c.name.trim(), restaurantId: b.id, item: items.find((i) => i.photo_key) ?? items[0], count: items.length });
    }
  }
  return [...seen.values()].slice(0, limit);
}

export function matchesQuery(text: string, query: string) {
  const q = query.trim().toLowerCase();
  return !q || text.toLowerCase().includes(q);
}

/** "08:00–22:00" when the business published its hours; null otherwise. */
export function hoursLabel(r: Pick<Restaurant, "open_time" | "close_time">): string | null {
  return r.open_time && r.close_time ? `${r.open_time}–${r.close_time}` : null;
}
