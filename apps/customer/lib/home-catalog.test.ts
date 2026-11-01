import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_HOME_MENU } from "@peebee/shared";
import { selectHomeFeatures, type HomeClusterId, type HomeFeatureCopy, type HomeFeatureId } from "./home-catalog";

const IDS: HomeFeatureId[] = [
  "shopping-list", "list", "boda", "food", "parcel", "groceries", "car", "stores", "pharmacy", "orders",
  "restaurants", "kitchens", "streetfood", "juices", "bakeries",
  "clean", "laundry", "fix", "my-class", "live", "tv", "discover", "connect",
  "move", "rideshare", "selfdrive", "workers", "hire", "luxury", "ambulance", "taxipress",
];

const COPY = Object.fromEntries(IDS.map((id) => [id, { label: id, detail: `${id} detail` }])) as Record<HomeFeatureId, HomeFeatureCopy>;

const labels: Record<HomeClusterId, string> = { ride: "Ride", buy: "Buy", eat: "Eat", learn: "Learn", work: "Work" };
const shortcuts = DEFAULT_HOME_MENU.hive.shortcuts;

function select(moduleOn: (key: string) => boolean, extra: Partial<Parameters<typeof selectHomeFeatures>[0]> = {}) {
  return selectHomeFeatures({
    moduleOn,
    copy: COPY,
    hiveShortcuts: shortcuts,
    clusterLabels: labels,
    hire: { hire: false, workers: false },
    special: { luxury: false, ambulance: false },
    taxipress: false,
    ...extra,
  });
}

const allOn = () => true;
const shown = (extra?: Partial<Parameters<typeof selectHomeFeatures>[0]>) =>
  select(allOn, { hire: { hire: true, workers: true }, special: { luxury: true, ambulance: true }, taxipress: true, ...extra });

test("start here still leads with the shopping list, boda, food and parcel sheets", () => {
  const { start } = select(allOn);
  assert.deepEqual(start.map((item) => item.id), ["shopping-list", "boda", "food", "parcel"]);
  assert.equal(start[0]?.action, "list");
  assert.equal(start[1]?.action, "boda");
  assert.equal(start[3]?.action, "parcel");
  assert.equal(start[2]?.href, "/food");
});

test("a switched-off start tile is filled by the next available task", () => {
  const off = new Set(["buy.shopping", "ride.boda"]);
  const { start } = select((key) => !off.has(key));
  assert.deepEqual(start.map((item) => item.id), ["food", "parcel", "car", "stores"]);
});

test("the five clusters list every subtype, including ones already in start here", () => {
  const { clusters } = shown();
  assert.deepEqual(clusters.map((group) => group.id), ["ride", "buy", "eat", "learn", "work"]);
  assert.deepEqual(clusters[0]?.items.map((item) => item.id), ["boda", "car", "rideshare", "selfdrive", "move", "parcel", "luxury", "taxipress", "ambulance"]);
  assert.equal(clusters[0]?.items.find((item) => item.id === "boda")?.href, "/ride/boda");
  assert.deepEqual(clusters[1]?.items.map((item) => item.id), ["list", "groceries", "stores", "pharmacy", "orders"]);
  assert.deepEqual(clusters[2]?.items.map((item) => item.id), ["food", "restaurants", "kitchens", "streetfood", "juices", "bakeries"]);
  assert.deepEqual(clusters[3]?.items.map((item) => item.id), ["my-class", "live", "tv", "discover", "connect"]);
  assert.deepEqual(clusters[4]?.items.map((item) => item.id), ["clean", "laundry", "fix", "workers", "hire"]);
});

test("admin defaults hide car, hire, vip and taxipress, and an empty cluster disappears", () => {
  const off = new Set(["ride.car", "ride.car.carpool", "ride.car.selfdrive", "ride.taxipress", "hive.hire", "buy.food", "learn", "learn.live", "learn.tv"]);
  const { clusters } = select((key) => !off.has(key));
  assert.deepEqual(clusters.map((group) => group.id), ["ride", "buy", "work"]);
  assert.deepEqual(clusters[0]?.items.map((item) => item.id), ["boda", "move", "parcel"]);
  assert.deepEqual(clusters[2]?.items.map((item) => item.id), ["clean", "laundry", "fix"]);
});

test("hive shortcuts keep the admin name and order", () => {
  const hiveShortcuts = [
    { id: "laundry" as const, label: "Wash", enabled: true },
    { id: "fix" as const, label: "Repair", enabled: false },
    { id: "clean" as const, label: "Sparkle", enabled: true },
    { id: "hire" as const, label: "Contracts", enabled: true },
    { id: "workers" as const, label: "Hands", enabled: true },
  ];
  const work = shown({ hiveShortcuts }).clusters.find((group) => group.id === "work");
  assert.deepEqual(work?.items.map((item) => [item.id, item.label]), [
    ["laundry", "Wash"],
    ["clean", "Sparkle"],
    ["hire", "Contracts"],
    ["workers", "Hands"],
  ]);
});

test("cluster titles use the admin names", () => {
  const { clusters } = select(allOn, { clusterLabels: { ride: "Go", buy: "Shop", eat: "Meals", learn: "Classes", work: "Jobs" } });
  assert.deepEqual(clusters.map((group) => group.label), ["Go", "Shop", "Meals", "Classes", "Jobs"]);
});
