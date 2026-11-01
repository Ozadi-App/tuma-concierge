import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_HOME_MENU } from "@peebee/shared";
import { selectHomeFeatures, type HomeFeatureCopy, type HomeFeatureId } from "./home-catalog";

const COPY = Object.fromEntries(
  (
    [
      "shopping-list",
      "boda",
      "food",
      "parcel",
      "groceries",
      "car",
      "stores",
      "clean",
      "laundry",
      "fix",
      "pharmacy",
      "learn",
      "move",
      "rideshare",
      "selfdrive",
      "workers",
      "hire",
      "luxury",
      "ambulance",
      "taxipress",
      "spotlight",
    ] as const
  ).map((id) => [id, { label: id, detail: `${id} detail` } satisfies HomeFeatureCopy]),
) as Record<HomeFeatureId, HomeFeatureCopy>;

const shortcuts = DEFAULT_HOME_MENU.hive.shortcuts;

function select(moduleOn: (key: string) => boolean, extra: Partial<Parameters<typeof selectHomeFeatures>[0]> = {}) {
  return selectHomeFeatures({
    moduleOn,
    copy: COPY,
    hiveShortcuts: shortcuts,
    learnLabel: "Learn",
    hire: { hire: false, workers: false },
    special: { luxury: false, ambulance: false },
    taxipress: false,
    channels: false,
    ...extra,
  });
}

const allOn = () => true;

test("default order leads with shopping list, boda, food and parcel", () => {
  const { start, more } = select(allOn);
  assert.deepEqual(start.map((item) => item.id), ["shopping-list", "boda", "food", "parcel"]);
  assert.deepEqual(more.map((item) => item.id), ["groceries", "car", "stores", "clean", "laundry", "fix", "pharmacy", "learn", "move", "rideshare", "selfdrive"]);
});

test("a switched-off feature drops out and the next one fills a large tile", () => {
  const off = new Set(["buy.shopping", "ride.boda"]);
  const { start, more } = select((key) => !off.has(key));
  assert.deepEqual(start.map((item) => item.id), ["food", "parcel", "car", "stores"]);
  assert.equal(more[0]?.id, "clean");
  assert.equal(start.some((item) => item.id === "shopping-list" || item.id === "groceries" || item.id === "boda"), false);
});

test("hive shortcuts keep the admin name and order, and a switched-off shortcut is absent", () => {
  const hiveShortcuts = [
    { id: "laundry" as const, label: "Wash", enabled: true },
    { id: "fix" as const, label: "Repair", enabled: false },
    { id: "clean" as const, label: "Sparkle", enabled: true },
    { id: "workers" as const, label: "Hands", enabled: true },
    { id: "hire" as const, label: "Contracts", enabled: true },
  ];
  const { more } = select(allOn, { hiveShortcuts, hire: { hire: true, workers: true } });
  const ids = more.map((item) => item.id);
  assert.deepEqual(
    more.filter((item) => item.id === "laundry" || item.id === "clean" || item.id === "fix").map((item) => [item.id, item.label]),
    [
      ["laundry", "Wash"],
      ["clean", "Sparkle"],
    ],
  );
  assert.ok(ids.indexOf("laundry") < ids.indexOf("clean"));
  assert.equal(ids.includes("fix"), false);
  assert.deepEqual(
    more.filter((item) => item.id === "workers" || item.id === "hire").map((item) => item.label),
    ["Hands", "Contracts"],
  );
});

test("hire, luxury, taxipress and spotlight stay hidden until their own switches are on", () => {
  const hidden = select(allOn);
  for (const id of ["workers", "hire", "luxury", "ambulance", "taxipress", "spotlight"] as const) {
    assert.equal([...hidden.start, ...hidden.more].some((item) => item.id === id), false, id);
  }
  const shown = select(allOn, {
    hire: { hire: true, workers: true },
    special: { luxury: true, ambulance: true },
    taxipress: true,
    channels: true,
  });
  assert.deepEqual(shown.more.slice(-6).map((item) => item.id), ["workers", "hire", "luxury", "ambulance", "taxipress", "spotlight"]);
});

test("learn uses the admin cluster name, and sheets are actions rather than links", () => {
  const { start } = select(allOn, { learnLabel: "Classes" });
  const learn = select(allOn, { learnLabel: "Classes" }).more.find((item) => item.id === "learn");
  assert.equal(learn?.label, "Classes");
  assert.equal(learn?.href, "/learn");
  const list = start.find((item) => item.id === "shopping-list");
  const boda = start.find((item) => item.id === "boda");
  const parcel = start.find((item) => item.id === "parcel");
  assert.equal(list?.action, "list");
  assert.equal(list?.href, undefined);
  assert.equal(boda?.action, "boda");
  assert.equal(parcel?.action, "parcel");
});

test("fewer than four available features still fill Start here and leave Also empty", () => {
  const on = new Set(["buy.food", "deliver.parcel"]);
  const { start, more } = select((key) => on.has(key));
  assert.deepEqual(start.map((item) => item.id), ["food", "parcel"]);
  assert.deepEqual(more, []);
});
