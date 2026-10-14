/**
 * Customer-app modules an admin can switch on or off (Admin → Settings →
 * Modules). Off means hidden completely: the bottom navigation item, the home
 * tile, and the page itself (a direct link shows "not available"). A group
 * switched off takes all of its children with it.
 *
 * This is separate from the older "service" switches (Settings → Services),
 * which pause new *orders* of a kind but leave the screens visible.
 */
export type ModuleGroup = "ride" | "shopping" | "food" | "deliver" | "services";

export type ModuleDef = {
  key: string;
  label: string;
  /** Set for children; the group key they live under. */
  group?: ModuleGroup;
  /** Customer-app path prefixes that belong to the module. */
  paths: string[];
};

export const MODULES = [
  { key: "ride", label: "Rides", paths: ["/ride"] },
  { key: "ride.boda", label: "Boda", group: "ride", paths: ["/ride/boda"] },
  { key: "ride.car", label: "Car", group: "ride", paths: ["/ride/car"] },
  { key: "ride.rideshare", label: "Rideshare", group: "ride", paths: ["/carpool"] },
  { key: "ride.selfdrive", label: "Selfdrive", group: "ride", paths: ["/rent"] },
  { key: "ride.move", label: "Move", group: "ride", paths: ["/ride/move", "/move"] },

  { key: "shopping", label: "Buy", paths: ["/shopping"] },
  { key: "shopping.list", label: "Shopping list", group: "shopping", paths: ["/shoplist"] },
  { key: "shopping.groceries", label: "Groceries", group: "shopping", paths: ["/groceries"] },
  { key: "shopping.stores", label: "Stores", group: "shopping", paths: ["/stores", "/store", "/product", "/cart"] },
  { key: "shopping.pharmacy", label: "Pharmacy", group: "shopping", paths: ["/pharmacy"] },
  { key: "shopping.spotlight", label: "Spotlight", group: "shopping", paths: ["/spotlight"] },

  { key: "food", label: "Eat", paths: ["/food"] },
  { key: "food.restaurants", label: "Restaurants", group: "food", paths: ["/restaurants"] },
  { key: "food.kitchens", label: "Kitchens", group: "food", paths: ["/kitchens"] },
  { key: "food.streetfood", label: "Street food", group: "food", paths: ["/streetfood"] },
  { key: "food.juices", label: "Juices", group: "food", paths: ["/juices"] },
  { key: "food.bakeries", label: "Bakeries", group: "food", paths: ["/bakeries"] },

  { key: "deliver", label: "Send", paths: ["/deliver"] },
  { key: "deliver.parcel", label: "Parcels", group: "deliver", paths: ["/deliver/parcel"] },

  { key: "services", label: "Services", paths: ["/services", "/service"] },
  { key: "services.laundry", label: "Laundry", group: "services", paths: ["/services/laundry"] },
  { key: "services.fix", label: "Fix", group: "services", paths: ["/services/fix"] },
  { key: "services.jobs", label: "Jobs", group: "services", paths: ["/service", "/services/jobs"] },
  { key: "services.learn", label: "Learn", group: "services", paths: ["/services/learn"] },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof MODULES)[number]["key"];
export const MODULE_KEYS: readonly ModuleKey[] = MODULES.map((m) => m.key);
export type ModuleSwitches = Record<ModuleKey, boolean>;

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);
}

/** All modules on. */
export function allModulesOn(): ModuleSwitches {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, true])) as ModuleSwitches;
}

/** Whether a module is visible. A child is hidden when its group is hidden; with no data yet, everything is on. */
export function isModuleOn(switches: Partial<ModuleSwitches> | null | undefined, key: ModuleKey): boolean {
  if (!switches) return true;
  if (switches[key] === false) return false;
  const def = (MODULES as readonly ModuleDef[]).find((m) => m.key === key);
  if (def?.group && switches[def.group] === false) return false;
  return true;
}

/**
 * The module a customer-app path belongs to (the most specific match), or
 * null for pages that aren't part of any module (home, account, wallet…).
 */
export function moduleForPath(pathname: string): ModuleKey | null {
  let best: { key: ModuleKey; len: number } | null = null;
  for (const m of MODULES as readonly ModuleDef[]) {
    for (const p of m.paths) {
      if ((pathname === p || pathname.startsWith(`${p}/`)) && (!best || p.length > best.len)) best = { key: m.key as ModuleKey, len: p.length };
    }
  }
  return best?.key ?? null;
}

/** True when the page at this path is switched off. */
export function isPathHidden(switches: Partial<ModuleSwitches> | null | undefined, pathname: string): boolean {
  const key = moduleForPath(pathname);
  return key ? !isModuleOn(switches, key) : false;
}
