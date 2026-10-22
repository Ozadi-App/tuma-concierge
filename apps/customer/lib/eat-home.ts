import type { FoodNearbyItem } from "@peebee/shared";

/** Food-item chips on the Eat home. `q` is sent to /v1/food/nearby-items, which matches dish name or menu section. */
export const EAT_CHIPS = [
  { id: "all", label: "All", q: "" },
  { id: "rolex", label: "Rolex", q: "rolex" },
  { id: "pilau", label: "Pilau", q: "pilau" },
  { id: "burger", label: "Burger", q: "burger" },
  { id: "pizza", label: "Pizza", q: "pizza" },
  { id: "chicken", label: "Chicken", q: "chicken" },
  { id: "juice", label: "Juice", q: "juice" },
  { id: "chapati", label: "Chapati", q: "chapati" },
] as const;
export type EatChipId = (typeof EAT_CHIPS)[number]["id"];

/** Splits the API's list (featured first, then nearest) into the three Eat home sections. */
export function eatSections(items: FoodNearbyItem[], hasPhoto: (i: FoodNearbyItem) => boolean = () => true) {
  // A featured dish with a photo leads; one without still shows, just later.
  const featured = items.filter((i) => i.isFeatured).sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a))).slice(0, 6);
  const slider = featured.length ? featured : items.slice(0, Math.min(3, items.length));
  const rest = items.filter((i) => !slider.includes(i))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return { slider, best: rest.slice(0, 4), more: rest.slice(4) };
}

export function kmLabel(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  return km < 0.1 ? "< 0.1 km" : `${km.toFixed(1)} km`;
}

export const ugx = (n: number) => Math.round(n).toLocaleString("en-UG");
export const dishHref = (i: Pick<FoodNearbyItem, "restaurantId" | "id">) => `/restaurants/${encodeURIComponent(i.restaurantId)}/items/${encodeURIComponent(i.id)}`;
