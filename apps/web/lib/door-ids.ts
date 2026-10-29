/**
 * The five doors on the customer home, in order. An admin can rename or
 * reorder them (or hide one) without a release: set NEXT_PUBLIC_DOORS_URL to a
 * JSON endpoint that returns `[{ id, label, order, enabled }]`. Anything the
 * endpoint says that is not one of these five ids is ignored, so a sixth door
 * cannot appear. If the endpoint is missing or fails, the defaults below stay.
 *
 * The ids never change (the app calls the fifth one "hive"). The name people
 * see is the label, and the web address uses `DOOR_SLUG`, so the fifth door
 * is `/work` while its id stays `hive`.
 *
 * The fifth door can carry a second name, as in the app: the main name is
 * "Work", the second is "Hire", and the two take turns in the bottom bar and
 * top bar once Hire is switched on. They are two features on one entity, so
 * only the label changes. While Hire is off, "Work" stays on its own.
 */
export const DOOR_IDS = ["ride", "buy", "eat", "learn", "hive"] as const;
export type DoorId = (typeof DOOR_IDS)[number];

export type Door = {
  id: DoorId;
  label: string;
  order: number;
  enabled: boolean;
  /** A second name that takes turns with `label`. Empty or missing keeps one fixed name. */
  altLabel?: string;
  /** Seconds each name stays up before the swap (2 to 30). */
  labelSeconds?: number;
};

export const DEFAULT_DOORS: Door[] = [
  { id: "ride", label: "Ride", order: 1, enabled: true },
  { id: "buy", label: "Buy", order: 2, enabled: true },
  { id: "eat", label: "Eat", order: 3, enabled: true },
  { id: "learn", label: "Learn", order: 4, enabled: true },
  { id: "hive", label: "Work", order: 5, enabled: true, altLabel: "Hire", labelSeconds: 4 },
];

/** The word in the address bar for each door. Only the fifth differs from its id. */
export const DOOR_SLUG: Record<DoorId, string> = { ride: "ride", buy: "buy", eat: "eat", learn: "learn", hive: "work" };

export function isDoorId(v: unknown): v is DoorId {
  return typeof v === "string" && (DOOR_IDS as readonly string[]).includes(v);
}

export function doorFromSlug(slug: unknown): DoorId | null {
  return (DOOR_IDS.find((id) => DOOR_SLUG[id] === slug) as DoorId | undefined) ?? null;
}

export const doorPath = (id: DoorId) => `/${DOOR_SLUG[id]}`;
