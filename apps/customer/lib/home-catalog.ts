import type { HiveShortcutId } from "@peebee/shared";

/** The four large tiles, then the fallbacks that fill a gap when one is switched off. */
export const HOME_START_ORDER = [
  "shopping-list",
  "boda",
  "food",
  "parcel",
  "groceries",
  "car",
  "stores",
  "hive-work",
  "pharmacy",
  "discover",
  "move",
  "rideshare",
  "selfdrive",
  "hive-people",
  "luxury",
  "taxipress",
  "ambulance",
] as const;

export type HomeFeatureId =
  | "shopping-list"
  | "list"
  | "boda"
  | "food"
  | "parcel"
  | "groceries"
  | "car"
  | "stores"
  | "pharmacy"
  | "orders"
  | "restaurants"
  | "kitchens"
  | "streetfood"
  | "juices"
  | "bakeries"
  | "clean"
  | "laundry"
  | "fix"
  | "my-class"
  | "live"
  | "tv"
  | "discover"
  | "connect"
  | "move"
  | "rideshare"
  | "selfdrive"
  | "workers"
  | "hire"
  | "luxury"
  | "ambulance"
  | "taxipress";

export type HomeFeatureAction = "list" | "boda" | "parcel";

export type HomeFeature = {
  id: HomeFeatureId;
  label: string;
  detail: string;
  href?: string;
  action?: HomeFeatureAction;
};

export type HomeFeatureCopy = { label: string; detail: string };

export type HomeClusterId = "ride" | "buy" | "eat" | "learn" | "work";

export type HomeCluster = {
  id: HomeClusterId;
  label: string;
  items: HomeFeature[];
};

const WORK_IDS = ["clean", "laundry", "fix"] as const;
const PERSON_IDS = ["workers", "hire"] as const;
const RIDE_IDS = ["boda", "car", "rideshare", "selfdrive", "move", "parcel", "luxury", "taxipress", "ambulance"] as const;
const BUY_IDS = ["list", "groceries", "stores", "pharmacy", "orders"] as const;
const EAT_IDS = ["food", "restaurants", "kitchens", "streetfood", "juices", "bakeries"] as const;
const LEARN_IDS = ["my-class", "live", "tv", "discover", "connect"] as const;

const META: Record<HomeFeatureId, { module: string; href?: string; action?: HomeFeatureAction }> = {
  "shopping-list": { module: "buy.shopping", action: "list" },
  list: { module: "buy.shopping", href: "/shoplist" },
  boda: { module: "ride.boda", href: "/ride/boda" },
  food: { module: "buy.food", href: "/food" },
  parcel: { module: "deliver.parcel", href: "/deliver/parcel" },
  groceries: { module: "buy.shopping", href: "/groceries" },
  car: { module: "ride.car", href: "/ride/car" },
  stores: { module: "buy.marketplace", href: "/stores" },
  pharmacy: { module: "buy.pharmacy", href: "/pharmacy" },
  orders: { module: "buy", href: "/orders/history" },
  restaurants: { module: "buy.food", href: "/restaurants" },
  kitchens: { module: "buy.food", href: "/kitchens" },
  streetfood: { module: "buy.food", href: "/streetfood" },
  juices: { module: "buy.food", href: "/juices" },
  bakeries: { module: "buy.food", href: "/bakeries" },
  clean: { module: "hive.work", href: "/services/clean" },
  laundry: { module: "hive.work", href: "/services/laundry" },
  fix: { module: "hive.work", href: "/services/fix" },
  "my-class": { module: "learn", href: "/learn/my" },
  live: { module: "learn.live", href: "/learn/live" },
  tv: { module: "learn.tv", href: "/learn/tv" },
  discover: { module: "learn", href: "/learn" },
  connect: { module: "learn", href: "/learn/connect" },
  move: { module: "ride.move", href: "/ride/move" },
  rideshare: { module: "ride.car.carpool", href: "/carpool" },
  selfdrive: { module: "ride.car.selfdrive", href: "/rent" },
  workers: { module: "hive.hire", href: "/services/hire/workers?segment=informal" },
  hire: { module: "hive.hire", href: "/services/hire" },
  luxury: { module: "ride.luxury", href: "/ride/luxury" },
  ambulance: { module: "ride.ambulance", href: "/ride/ambulance" },
  taxipress: { module: "ride.taxipress", href: "/ride/taxipress" },
};

/** The Start here shopping list and boda tiles still open their sheets. Cluster rows use the submenu routes. */
const START_ACTION: Partial<Record<HomeFeatureId, { href?: string; action?: HomeFeatureAction }>> = {
  "shopping-list": { action: "list" },
  boda: { action: "boda" },
  parcel: { action: "parcel" },
};

export const HOME_PRIMARY_COUNT = 4;

type Shortcut = { id: HiveShortcutId; label: string; enabled: boolean };

function featureFrom(id: HomeFeatureId, copy: HomeFeatureCopy, labelOverride?: string, asStart = false): HomeFeature {
  const meta = META[id];
  const start = asStart ? START_ACTION[id] : undefined;
  return {
    id,
    label: labelOverride?.trim() || copy.label,
    detail: copy.detail,
    href: start?.action ? undefined : meta.href,
    action: start?.action,
  };
}

type Input = {
  moduleOn: (key: string) => boolean;
  copy: Record<HomeFeatureId, HomeFeatureCopy>;
  hiveShortcuts: readonly Shortcut[];
  clusterLabels: Record<HomeClusterId, string>;
  hire: { hire: boolean; workers: boolean };
  special: { luxury: boolean; ambulance: boolean };
  taxipress: boolean;
};

/**
 * Start here is the first four available everyday tasks.
 * Under that, Ride, Buy, Eat, Learn and Work each list every subtype the bottom bar already has.
 * A task in Start here is repeated in its cluster so the group is complete.
 * Luxury, Ambulance and Taxipress still wait on a vehicle or on Taxipress being on.
 */
export function selectHomeFeatures(input: Input): { start: HomeFeature[]; clusters: HomeCluster[] } {
  const { moduleOn, copy, hiveShortcuts, clusterLabels, hire, special, taxipress } = input;
  const shortcut = (id: HiveShortcutId) => hiveShortcuts.find((item) => item.id === id);

  const allowed = (id: HomeFeatureId): boolean => {
    if (!moduleOn(META[id].module)) return false;
    const item = id === "clean" || id === "laundry" || id === "fix" || id === "workers" || id === "hire" ? shortcut(id) : undefined;
    if (item && !item.enabled) return false;
    if (id === "workers" && !hire.workers) return false;
    if (id === "hire" && !hire.hire) return false;
    if (id === "luxury" && !special.luxury) return false;
    if (id === "ambulance" && !special.ambulance) return false;
    if (id === "taxipress" && !taxipress) return false;
    return true;
  };

  const orderedShortcuts = (ids: readonly HiveShortcutId[]) =>
    hiveShortcuts.filter((item): item is Shortcut & { id: (typeof ids)[number] } =>
      (ids as readonly string[]).includes(item.id) && allowed(item.id),
    );

  const start: HomeFeature[] = [];
  for (const slot of HOME_START_ORDER) {
    if (start.length >= HOME_PRIMARY_COUNT) break;
    if (slot === "hive-work") {
      for (const item of orderedShortcuts(WORK_IDS)) {
        if (start.length >= HOME_PRIMARY_COUNT) break;
        start.push(featureFrom(item.id, copy[item.id], item.label, true));
      }
      continue;
    }
    if (slot === "hive-people") {
      for (const item of orderedShortcuts(PERSON_IDS)) {
        if (start.length >= HOME_PRIMARY_COUNT) break;
        start.push(featureFrom(item.id, copy[item.id], item.label, true));
      }
      continue;
    }
    if (!allowed(slot)) continue;
    start.push(featureFrom(slot, copy[slot], undefined, true));
  }

  const fixed = (ids: readonly HomeFeatureId[]) => ids.filter(allowed).map((id) => featureFrom(id, copy[id]));
  const workItems = [...orderedShortcuts(WORK_IDS), ...orderedShortcuts(PERSON_IDS)].map((item) => featureFrom(item.id, copy[item.id], item.label));
  const groups: HomeCluster[] = [
    { id: "ride", label: clusterLabels.ride, items: fixed(RIDE_IDS) },
    { id: "buy", label: clusterLabels.buy, items: fixed(BUY_IDS) },
    { id: "eat", label: clusterLabels.eat, items: fixed(EAT_IDS) },
    { id: "learn", label: clusterLabels.learn, items: fixed(LEARN_IDS) },
    { id: "work", label: clusterLabels.work, items: workItems },
  ];

  return { start, clusters: groups.filter((group) => group.items.length > 0) };
}
