import type { HiveShortcutId } from "@peebee/shared";

/** Customer-facing destinations on the new Home, in the platform's default priority.
 * The first four that are actually available become the large tiles. The rest stay as compact rows. */
export const HOME_FEATURE_ORDER = [
  "shopping-list",
  "boda",
  "food",
  "parcel",
  "groceries",
  "car",
  "stores",
  "hive-work",
  "pharmacy",
  "learn",
  "move",
  "rideshare",
  "selfdrive",
  "hive-people",
  "luxury",
  "ambulance",
  "taxipress",
  "spotlight",
] as const;

export type HomeFeatureId =
  | "shopping-list"
  | "boda"
  | "food"
  | "parcel"
  | "groceries"
  | "car"
  | "stores"
  | "clean"
  | "laundry"
  | "fix"
  | "pharmacy"
  | "learn"
  | "move"
  | "rideshare"
  | "selfdrive"
  | "workers"
  | "hire"
  | "luxury"
  | "ambulance"
  | "taxipress"
  | "spotlight";

export type HomeFeatureAction = "list" | "boda" | "parcel";

export type HomeFeature = {
  id: HomeFeatureId;
  label: string;
  detail: string;
  /** In-app path. Absent when the tile opens a sheet instead. */
  href?: string;
  /** Opens an existing home sheet. */
  action?: HomeFeatureAction;
};

export type HomeFeatureCopy = { label: string; detail: string };

const WORK_IDS = ["clean", "laundry", "fix"] as const;
const PERSON_IDS = ["workers", "hire"] as const;

const META: Record<HomeFeatureId, { module: string; href?: string; action?: HomeFeatureAction }> = {
  "shopping-list": { module: "buy.shopping", action: "list" },
  boda: { module: "ride.boda", action: "boda" },
  food: { module: "buy.food", href: "/food" },
  parcel: { module: "deliver.parcel", action: "parcel" },
  groceries: { module: "buy.shopping", href: "/groceries" },
  car: { module: "ride.car", href: "/ride/car" },
  stores: { module: "buy.marketplace", href: "/stores" },
  clean: { module: "hive.work", href: "/services/clean" },
  laundry: { module: "hive.work", href: "/services/laundry" },
  fix: { module: "hive.work", href: "/services/fix" },
  pharmacy: { module: "buy.pharmacy", href: "/pharmacy" },
  learn: { module: "learn", href: "/learn" },
  move: { module: "ride.move", href: "/ride/move" },
  rideshare: { module: "ride.car.carpool", href: "/carpool" },
  selfdrive: { module: "ride.car.selfdrive", href: "/rent" },
  workers: { module: "hive.hire", href: "/services/hire/workers?segment=informal" },
  hire: { module: "hive.hire", href: "/services/hire" },
  luxury: { module: "ride.luxury", href: "/ride/luxury" },
  ambulance: { module: "ride.ambulance", href: "/ride/ambulance" },
  taxipress: { module: "ride.taxipress", href: "/ride/taxipress" },
  spotlight: { module: "channels", href: "/spotlight" },
};

/** How many available features lead the page as large tiles. */
export const HOME_PRIMARY_COUNT = 4;

type Shortcut = { id: HiveShortcutId; label: string; enabled: boolean };

function featureFrom(id: HomeFeatureId, copy: HomeFeatureCopy, labelOverride?: string): HomeFeature {
  const meta = META[id];
  return {
    id,
    label: labelOverride?.trim() || copy.label,
    detail: copy.detail,
    href: meta.href,
    action: meta.action,
  };
}

/**
 * Default Home order, with anything an admin has switched off left out.
 * Hive work and Hire keep the admin's names and the order of those shortcuts.
 * Luxury, Ambulance, Taxipress and Spotlight also wait on their own switches.
 */
export function selectHomeFeatures(input: {
  moduleOn: (key: string) => boolean;
  copy: Record<HomeFeatureId, HomeFeatureCopy>;
  hiveShortcuts: readonly Shortcut[];
  learnLabel: string;
  hire: { hire: boolean; workers: boolean };
  special: { luxury: boolean; ambulance: boolean };
  taxipress: boolean;
  channels: boolean;
}): { start: HomeFeature[]; more: HomeFeature[] } {
  const { moduleOn, copy, hiveShortcuts, learnLabel, hire, special, taxipress, channels } = input;
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
    if (id === "spotlight" && !channels) return false;
    return true;
  };

  const orderedShortcuts = (ids: readonly HiveShortcutId[]) =>
    hiveShortcuts.filter((item): item is Shortcut & { id: (typeof ids)[number] } =>
      (ids as readonly string[]).includes(item.id) && allowed(item.id),
    );

  const visible: HomeFeature[] = [];
  for (const slot of HOME_FEATURE_ORDER) {
    if (slot === "hive-work") {
      for (const item of orderedShortcuts(WORK_IDS)) visible.push(featureFrom(item.id, copy[item.id], item.label));
      continue;
    }
    if (slot === "hive-people") {
      for (const item of orderedShortcuts(PERSON_IDS)) visible.push(featureFrom(item.id, copy[item.id], item.label));
      continue;
    }
    if (!allowed(slot)) continue;
    const override = slot === "learn" ? learnLabel : undefined;
    visible.push(featureFrom(slot, copy[slot], override));
  }

  return { start: visible.slice(0, HOME_PRIMARY_COUNT), more: visible.slice(HOME_PRIMARY_COUNT) };
}
