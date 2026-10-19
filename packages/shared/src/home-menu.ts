/** What the customer app's main menu calls things. Names, order and on/off are
 * admin settings so a name can be changed without a release; the built-in
 * defaults are only the starting point. */

export const HOME_CLUSTER_IDS = ["ride", "shopping", "food", "learn", "hive"] as const;
export type HomeClusterId = (typeof HOME_CLUSTER_IDS)[number];

/** The shortcuts inside Hive. The first three are things Peebee delivers at a standard price;
 * "hire" is the separate marketplace for finding a person. */
export const HIVE_SHORTCUT_IDS = ["laundry", "clean", "fix", "hire"] as const;
export type HiveShortcutId = (typeof HIVE_SHORTCUT_IDS)[number];

export type HomeMenuSettings = {
  clusters: Record<HomeClusterId, { label: string }>;
  hive: {
    eyebrow: string;
    description: string;
    /** Order here is the order customers see. */
    shortcuts: { id: HiveShortcutId; label: string; enabled: boolean }[];
    /** The strip under the Hive shortcuts that points to the Hire marketplace. */
    hireBanner: { enabled: boolean; title: string; text: string };
  };
};

export const DEFAULT_HOME_MENU: HomeMenuSettings = {
  clusters: {
    ride: { label: "Ride" },
    shopping: { label: "Buy" },
    food: { label: "Eat" },
    learn: { label: "Learn" },
    hive: { label: "Hive" },
  },
  hive: {
    eyebrow: "Peebee gets it done",
    description: "Laundry, cleaning and repairs at a clear price. Tell us what you need and Peebee takes care of it.",
    shortcuts: [
      { id: "laundry", label: "Laundry", enabled: true },
      { id: "clean", label: "Clean", enabled: true },
      { id: "fix", label: "Fix", enabled: true },
      { id: "hire", label: "Hire", enabled: true },
    ],
    hireBanner: {
      enabled: true,
      title: "Need a person instead?",
      text: "Hire someone for a quick job, a project or a longer contract.",
    },
  },
};

/** Fills any gap in a stored value with the defaults so a partial or old value never breaks the menu.
 * Hive shortcuts keep the admin's order; any shortcut missing from it is appended. */
export function resolveHomeMenu(stored: Partial<HomeMenuSettings> | null | undefined): HomeMenuSettings {
  const base = DEFAULT_HOME_MENU;
  const clusters = { ...base.clusters };
  for (const id of HOME_CLUSTER_IDS) {
    const label = stored?.clusters?.[id]?.label?.trim();
    if (label) clusters[id] = { label };
  }
  const seen = new Set<HiveShortcutId>();
  const shortcuts: HomeMenuSettings["hive"]["shortcuts"] = [];
  for (const item of stored?.hive?.shortcuts ?? []) {
    const fallback = base.hive.shortcuts.find((s) => s.id === item.id);
    if (!fallback || seen.has(item.id)) continue;
    seen.add(item.id);
    shortcuts.push({ id: item.id, label: item.label?.trim() || fallback.label, enabled: item.enabled !== false });
  }
  for (const fallback of base.hive.shortcuts) if (!seen.has(fallback.id)) shortcuts.push({ ...fallback });
  const banner = stored?.hive?.hireBanner;
  return {
    clusters,
    hive: {
      eyebrow: stored?.hive?.eyebrow?.trim() || base.hive.eyebrow,
      description: stored?.hive?.description?.trim() || base.hive.description,
      shortcuts,
      hireBanner: {
        enabled: banner?.enabled ?? base.hive.hireBanner.enabled,
        title: banner?.title?.trim() || base.hive.hireBanner.title,
        text: banner?.text?.trim() || base.hive.hireBanner.text,
      },
    },
  };
}
