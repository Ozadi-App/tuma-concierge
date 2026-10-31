import type { DoorId } from "./door-ids";

/**
 * Which Admin → Services module controls each part of the site. The keys are the platform's module keys
 * (packages/shared/src/modules.ts); a module that is off in Admin hides its door, service, partner page and link
 * here, exactly as it does in the app. Anything not listed follows its door.
 */
export const DOOR_MODULE: Record<DoorId, string> = {
  ride: "ride",
  buy: "buy",
  eat: "buy.food",
  learn: "learn",
  hive: "hive",
};

/** "<door>/<sub key>" → module. A sub-feature with no entry here follows its door. */
export const SUB_MODULE: Record<string, string> = {
  "ride/boda": "ride.boda",
  "ride/cars": "ride.car",
  "ride/rideshare": "ride.car.carpool",
  "ride/selfdrive": "ride.car.selfdrive",
  "ride/move": "ride.move",
  "ride/parcels": "deliver.parcel",
  "ride/taxipress": "ride.taxipress",
  "ride/vip": "ride.luxury",
  "ride/ambulance": "ride.ambulance",
  "buy/list": "buy.shopping",
  "buy/groceries": "buy.shopping",
  "buy/stores": "buy.marketplace",
  "buy/pharmacy": "buy.pharmacy",
  "buy/spotlight": "channels",
  "buy/shared-links": "buy.shopping",
  "buy/substitutes": "buy.shopping",
  "learn/my-class": "learn.enrolments",
  "learn/live": "learn.live",
  "learn/tv": "learn.tv",
  "hive/clean": "hive.work",
  "hive/laundry": "hive.work",
  "hive/fix": "hive.work",
  "hive/workers": "hive.hire",
  "hive/hire": "hive.hire",
  "hive/matching": "hive.hire",
};

/** Partner pages whose own service has a switch; every other partner page follows its door. */
export const PARTNER_MODULE: Record<string, string> = {
  boda: "ride.boda",
  driver: "ride.car",
  "car-owner": "ride.car",
  rideshare: "ride.car.carpool",
  selfdrive: "ride.car.selfdrive",
  move: "ride.move",
  taxi: "ride.taxipress",
  vip: "ride.luxury",
  ambulance: "ride.ambulance",
  store: "buy.marketplace",
  grocery: "buy.shopping",
  pharmacy: "buy.pharmacy",
  cleaner: "hive.work",
  laundry: "hive.work",
  fixer: "hive.work",
  worker: "hive.work",
  talent: "hive.hire",
};

/** Partner pages use "work" for the fifth door; the doors use "hive". */
export const PARTNER_DOOR_MODULE: Record<string, string> = { ride: "ride", buy: "buy", eat: "buy.food", learn: "learn", work: "hive" };

/** The module a sub-feature depends on (its own, else its door's). */
export const moduleOfSub = (door: DoorId, key: string): string => SUB_MODULE[`${door}/${key}`] ?? DOOR_MODULE[door];

export const moduleOfPartner = (slug: string, door: string): string => PARTNER_MODULE[slug] ?? PARTNER_DOOR_MODULE[door] ?? "ride";

/** A pop-up feature ("ride/parcels", "acct/wallet"): account features have no switch; the others follow their sub-feature. */
export function moduleOfFeatureId(id: string): string | null {
  const [door, key] = id.split("/");
  if (!key || door === "acct") return null;
  return SUB_MODULE[id] ?? DOOR_MODULE[door as DoorId] ?? null;
}

/** The module behind a site link such as "/ride/parcels" or "/work"; null for a link with no switch (/wallet, /about). */
export function moduleOfHref(href: string): string | null {
  const [slug, key] = href.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const door = (Object.keys(DOOR_MODULE) as DoorId[]).find((d) => (d === "hive" ? "work" : d) === slug);
  if (!door) return null;
  return key ? moduleOfSub(door, key) : DOOR_MODULE[door];
}
