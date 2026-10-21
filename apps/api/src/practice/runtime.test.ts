import assert from "node:assert/strict";
import test from "node:test";
import {
  type FoodSellerOrders,
  createPracticeFetch,
  isPracticeJourneyComplete,
  startPracticeMode,
} from "@peebee/shared";

test("Food practice order tabs stay local and follow the sample settlement", async () => {
  installStorage();
  const fetcher = createPracticeFetch("restaurant", (async () => { throw new Error("Must not access live orders"); }) as typeof fetch);
  startPracticeMode("restaurant");
  const first = await (await fetcher("https://api.test/v1/restaurants/me/orders?view=active")).json() as FoodSellerOrders;
  assert.equal(first.orders.length, 1); assert.equal(first.orders[0].stage, "Shop");
  assert.equal((await (await fetcher("https://api.test/v1/restaurants/me/orders?view=history")).json() as FoodSellerOrders).orders.length, 0);
  await fetcher("https://api.test/v1/merchant-payments/mpay_practice/merchant-confirm", { method: "POST", body: "{}" });
  await fetcher("https://api.test/v1/merchants/merchant-practice/settlements", { method: "POST", body: "{}" });
  const history = await (await fetcher("https://api.test/v1/restaurants/me/orders?view=history")).json() as FoodSellerOrders;
  assert.equal(history.orders.length, 1); assert.equal(history.orders[0].stage, "Settle"); assert.deepEqual(history.counts, { active: 0, history: 1 });
});

test("Fuel attendant practice: receive a relay parcel from the matatu, then the customer collects it", async () => {
  installStorage();
  const fetcher = createPracticeFetch("gas", (async () => { throw new Error("Must not access live parcels"); }) as typeof fetch);
  startPracticeMode("gas");
  type Parcels = { incoming: { order_id: string; operator_name: string }[]; held: { customer_name: string }[]; recent: unknown[] };
  const parcels = async () => (await (await fetcher("https://api.test/v1/gas/relay/parcels")).json()) as Parcels;
  const post = (path: string, code: string) => fetcher(`https://api.test/v1/gas/relay/${path}`, { method: "POST", body: JSON.stringify({ code }) });
  const first = await parcels();
  assert.equal(first.incoming.length, 1);
  const matatuCode = first.incoming[0].operator_name.match(/\d{6}/)![0];
  assert.equal((await post("release", "135790")).status, 404, "nothing to hand over before it arrives");
  assert.equal((await post("receive", "000000")).status, 404);
  assert.equal((await post("receive", matatuCode)).status, 200);
  const held = await parcels();
  assert.equal(held.incoming.length, 0);
  const customerCode = held.held[0].customer_name.match(/\d{6}/)![0];
  assert.equal((await post("release", customerCode)).status, 200);
  const done = await parcels();
  assert.deepEqual([done.held.length, done.recent.length], [0, 1]);
  const journey = (await (await fetcher(`https://api.test/v1/gas/relay/parcels/${first.incoming[0].order_id}`)).json()) as { relay: { releasedTo: string } };
  assert.equal(journey.relay.releasedTo, "customer");
});

function installStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage, location: { origin: "https://customer.test" } } });
}

test("customer practice runs the real order API contract without reaching live fetch", async () => {
  installStorage();
  let liveCalls = 0;
  const practiceFetch = createPracticeFetch("customer", (async () => {
    liveCalls += 1;
    throw new Error("live fetch must not be called");
  }) as typeof fetch);
  startPracticeMode("customer");

  await practiceFetch("https://api.test/v1/lists", { method: "POST", body: JSON.stringify({ items: [{ name: "Rice", quantity: 1, unitCost: 10_000 }] }) });
  await practiceFetch("https://api.test/v1/orders", { method: "POST", body: JSON.stringify({ type: "shopping", estimatedTotal: 10_000 }) });
  const created = await (await practiceFetch("https://api.test/v1/orders/practice-order")).json() as { order: { stage: string; rider_id: string | null } };
  assert.equal(created.order.stage, "Create");
  assert.equal(created.order.rider_id, null);

  await practiceFetch("https://api.test/v1/orders/practice-order/match", { method: "POST" });
  await practiceFetch("https://api.test/v1/orders/practice-order/fund", { method: "POST", body: "{}" });
  const funded = await (await practiceFetch("https://api.test/v1/orders/practice-order")).json() as { order: { stage: string; rider_id: string | null } };
  assert.equal(funded.order.stage, "Shop");
  assert.equal(funded.order.rider_id, "practice-rider");
  assert.equal(liveCalls, 0);
});

test("practice car picker defaults to normal convenient and assigns random all-distance demo drivers", async () => {
  installStorage();
  const practiceFetch = createPracticeFetch("customer", (async () => { throw new Error("live fetch must not be called"); }) as typeof fetch);
  startPracticeMode("customer");
  const config = await (await practiceFetch("https://api.test/v1/car/config")).json() as { serviceTiers: object; categories: Array<{ id: string; seats: number }> };
  assert.ok(config.serviceTiers);
  assert.ok(config.categories.some((category) => category.seats === 4));
  assert.ok(config.categories.some((category) => category.seats === 7));
  const distantOptions = await (await practiceFetch("https://api.test/v1/car/service-options?pickupLat=80&pickupLng=140&destinationLat=-70&destinationLng=-140")).json() as { options: Array<{ size: string; tier: string; nearby: number }> };
  assert.equal(distantOptions.options.length, 4);
  assert.ok(distantOptions.options.every((option) => option.nearby === 2), "practice drivers are available regardless of distance");
  const defaultOption = distantOptions.options.find((option) => option.size === "normal" && option.tier === "convenient");
  assert.equal(defaultOption?.nearby, 2);

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    let response = await practiceFetch("https://api.test/v1/car/bookings", { method: "POST", body: JSON.stringify({ vehicleSize: "large", serviceTier: "comfort", pickupLat: 0, pickupLng: 0, destinationLat: 0.01, destinationLng: 0.01 }) });
    assert.equal(response.status, 201);
    let info = await (await practiceFetch("https://api.test/v1/car/bookings/practice-order/info")).json() as { driverName: string; vehicleName: string };
    assert.equal(info.driverName, "Amina Nankya");
    assert.match(info.vehicleName, /Toyota Voxy/);
    Math.random = () => 0.99;
    response = await practiceFetch("https://api.test/v1/car/bookings", { method: "POST", body: JSON.stringify({ vehicleSize: "large", serviceTier: "comfort", pickupLat: -75, pickupLng: 100, destinationLat: 70, destinationLng: -100 }) });
    assert.equal(response.status, 201);
    info = await (await practiceFetch("https://api.test/v1/car/bookings/practice-order/info")).json() as { driverName: string; vehicleName: string };
    assert.equal(info.driverName, "Ruth Atim");
    assert.match(info.vehicleName, /Toyota Noah/);
  } finally {
    Math.random = originalRandom;
  }
});

test("rideshare practice lists nearby trips and books them without live network access", async () => {
  installStorage();
  const practiceFetch = createPracticeFetch("customer", (async () => { throw new Error("live fetch must not be called"); }) as typeof fetch);
  startPracticeMode("customer");

  const response = await practiceFetch("https://api.test/v1/car/carpool/trips?nearLat=0.32&nearLng=32.58&nearLabel=Kitaasa");
  const result = await response.json() as { trips: Array<{ id: string; originLabel: string; driverName: string; seatPrice: number }> };
  assert.ok(result.trips.length > 0);
  assert.match(result.trips[0].originLabel, /Kitaasa/);
  assert.doesNotMatch(result.trips[0].driverName, /demo/i, "the global header indicates practice mode");
  assert.ok(result.trips.every((trip) => trip.seatPrice > 0));

  const booking = await practiceFetch(`https://api.test/v1/car/carpool/trips/${result.trips[0].id}/seats`, {
    method: "POST",
    body: JSON.stringify({ seats: 1 }),
  });
  assert.equal(booking.status, 201);
  const body = await booking.json() as { order: { rider_id: string | null; estimated_total: number } };
  assert.match(body.order.rider_id ?? "", /^practice-car-driver-/);
  assert.equal(body.order.estimated_total, result.trips[0].seatPrice);
});

test("practice parcel fare and stored total use the same rounded amount", async () => {
  installStorage();
  const practiceFetch = createPracticeFetch("customer", (async () => { throw new Error("live fetch must not be called"); }) as typeof fetch);
  startPracticeMode("customer");
  for (const [estimatedTotal, expected] of [[3_102, 3_000], [3_350, 3_000], [3_351, 3_500]]) {
    const response = await practiceFetch("https://api.test/v1/orders", {
      method: "POST",
      body: JSON.stringify({ type: "parcel", estimatedTotal }),
    });
    const { order } = await response.json() as { order: { estimated_total: number; delivery_fee: number } };
    assert.equal(order.delivery_fee, expected);
    assert.equal(order.estimated_total, expected);
  }
});

test("merchant practice confirmation marks that role's journey complete", async () => {
  installStorage();
  const practiceFetch = createPracticeFetch("merchant", (async () => { throw new Error("live fetch must not be called"); }) as typeof fetch);
  startPracticeMode("merchant");
  assert.equal(isPracticeJourneyComplete("merchant"), false);
  await practiceFetch("https://api.test/v1/merchant-payments/mpay_practice/merchant-confirm", { method: "POST", body: JSON.stringify({ amount: 28_000 }) });
  assert.equal(isPracticeJourneyComplete("merchant"), true);
});

test("Taxipress practice: book with the practice wallet and follow the taxi from the line to arrival", async (t) => {
  installStorage();
  const fetcher = createPracticeFetch("customer", (async () => { throw new Error("Must not access live Taxipress"); }) as typeof fetch);
  startPracticeMode("customer");
  const get = async (path: string) => (await fetcher(`https://api.test${path}`)).json() as Promise<any>;
  const post = (path: string, body: object = {}) => fetcher(`https://api.test${path}`, { method: "POST", body: JSON.stringify(body) });

  const config = await get("/v1/taxipress/config");
  assert.equal(config.enabled, true);
  assert.equal(config.routes[0].fromName, "Entebbe Stage", "practice starts where the customer is");
  const line = await get(`/v1/taxipress/routes/${config.routes[0].id}/queue`);
  assert.equal(line.line.length, 3);
  const taxi = line.line[0];
  assert.equal((await get("/v1/wallet")).balance, 2_000_000, "the practice wallet starts loaded");

  const booked = await post("/v1/taxipress/bookings", { queueId: taxi.id, seats: 2, payment: "app" });
  assert.equal(booked.status, 201);
  const { booking } = (await booked.json()) as { booking: any };
  assert.equal(booking.paymentStatus, "paid");
  assert.equal(booking.amount, 2 * config.routes[0].farePerSeat);
  assert.equal((await get("/v1/wallet")).balance, 2_000_000 - booking.amount, "the seats were paid for from the practice wallet");
  assert.equal((await get(`/v1/taxipress/routes/${config.routes[0].id}/queue`)).line[0].seatsLeft, taxi.seatsLeft - 2);

  assert.equal((await post("/v1/taxipress/bookings", { queueId: taxi.id, seats: 99, payment: "app" })).status, 400);
  assert.equal((await post("/v1/taxipress/bookings", { queueId: taxi.id, seats: 4, payment: "app" })).status, 409, "no room for four more");
  const cash = await post("/v1/taxipress/bookings", { queueId: line.line[2].id, seats: 1, payment: "cash" });
  const cashBooking = ((await cash.json()) as { booking: any; order: { id: string } });
  assert.equal(cashBooking.booking.paymentStatus, "pay_driver");
  assert.equal((await post(`/v1/orders/${cashBooking.order.id}/fund`, { paymentMethod: "cash" })).status, 200);
  assert.equal((await get("/v1/wallet")).balance, 2_000_000 - booking.amount, "cash does not touch the wallet");

  const now = Date.now();
  const at = async (seconds: number) => {
    t.mock.method(Date, "now", () => now + seconds * 1000);
    return (await get(`/v1/taxipress/bookings/${booking.id}`)).booking;
  };
  assert.deepEqual(((b) => [b.status, b.taxi.status])(await at(5)), ["booked", "in_line"], "waiting in the line");
  assert.deepEqual(((b) => [b.status, b.taxi.status])(await at(25)), ["booked", "boarding"], "boarding now");
  assert.deepEqual(((b) => [b.status, b.taxi.status])(await at(45)), ["boarded", "boarding"], "the driver confirmed the ticket");
  assert.deepEqual(((b) => [b.status, b.taxi.status])(await at(80)), ["boarded", "on_road"]);
  const road = await get(`/v1/taxipress/routes/${config.routes[0].id}/queue`);
  assert.equal(road.onRoad.length, 2, "the cash booking on another taxi has set off too");
  assert.equal(road.line.length, 1);
  assert.deepEqual(((b) => [b.status, b.taxi.status])(await at(120)), ["completed", "arrived"]);
  assert.equal((await get(`/v1/taxipress/routes/${config.routes[0].id}/queue`)).line.length, 3, "the taxi is back in the line");

  const broke = await post("/v1/taxipress/bookings", { queueId: line.line[1].id, seats: 1, payment: "app" });
  assert.equal(broke.status, 201);
  assert.equal((await get("/v1/taxipress/bookings/mine")).bookings.length, 3);
  const ledger = (await get("/v1/wallet")).ledger as Array<{ type: string }>;
  assert.equal(ledger.filter((e) => e.type === "order_payment").length, 2);
  t.mock.restoreAll();
});

test("Entebbe practice: shop and food orders paid from the practice wallet, a rider takes them and rings on arrival", async (t) => {
  installStorage();
  const fetcher = createPracticeFetch("customer", (async () => { throw new Error("Must not access the live app"); }) as typeof fetch);
  startPracticeMode("customer");
  const get = async (path: string) => (await fetcher(`https://api.test${path}`)).json() as Promise<any>;
  const post = (path: string, body: object = {}) => fetcher(`https://api.test${path}`, { method: "POST", body: JSON.stringify(body) });

  // The world is centred on Entebbe, with a few Kampala shops for the long way round.
  const stores = (await get("/v1/marketplace/stores?lat=0.0612&lng=32.4637")).stores as Array<{ id: string; name: string; address: string; distance_km: number; category: string }>;
  assert.equal(stores.filter((s) => s.id.startsWith("pe_")).length, 10);
  assert.equal(stores.filter((s) => !s.id.startsWith("pe_")).length, 3, "very few shops in Kampala");
  assert.ok(stores.slice(0, 10).every((s) => s.id.startsWith("pe_")), "the nearest shops are the Entebbe ones");
  assert.ok(stores[0].distance_km < 3);
  for (const category of ["groceries", "stores", "pharmacy"]) assert.ok(stores.some((s) => s.id.startsWith("pe_") && s.category === category), `Entebbe ${category}`);
  const products = (await get("/v1/marketplace/stores/pe_lakeside_mart/products")).products as Array<{ id: string; title: string; price: number }>;
  assert.ok(products.length >= 5);
  const restaurants = (await get("/v1/restaurants")).restaurants as Array<{ id: string; address: string; name: string }>;
  assert.equal(restaurants.length, 12);
  assert.ok(restaurants.every((r) => /Entebbe|Katabi|Kitoro|Lunyo|Bugonga/.test(r.address)), "every food place is around Entebbe");
  assert.equal((await get("/v1/pharmacy/pharmacies")).pharmacies.filter((p: { id: string }) => p.id.startsWith("pe_")).length, 2);

  // A shop order: a rider is found for you, you pay from the wallet, and the rider brings it.
  const milk = products[0]!;
  const checkout = await post("/v1/marketplace/checkout", { items: [{ storeId: "pe_lakeside_mart", title: milk.title, quantity: 2, price: milk.price }], destinationAddress: "Kitoro Road, Entebbe" });
  assert.equal(checkout.status, 201);
  const { order } = (await checkout.json()) as { order: any };
  assert.equal(order.stage, "Match");
  assert.ok(order.rider_id && order.rider_name !== "Daniel", "a rider from the Entebbe roster took it");
  assert.equal(order.pickup_address, "Victoria Mall, Entebbe Road");
  assert.ok(order.delivery_fee >= 3_000 && order.delivery_fee < 10_000, "a short boda ride inside Entebbe");
  const total = 2 * milk.price + order.delivery_fee;
  assert.equal(order.estimated_total, total);

  const before = (await get("/v1/wallet")).balance as number;
  assert.equal((await post("/v1/orders/practice-order/fund", { paymentMethod: "wallet", useWallet: true })).status, 200);
  assert.equal((await get("/v1/wallet")).balance, before - total, "the order was paid from the practice wallet");
  const now = Date.now();
  const stageAt = async (seconds: number) => {
    t.mock.method(Date, "now", () => now + seconds * 1000);
    return ((await get("/v1/orders/practice-order")).order as { stage: string }).stage;
  };
  assert.equal(await stageAt(5), "Shop", "the rider is collecting it");
  assert.equal(await stageAt(30), "Deliver", "on the way");
  assert.equal(await stageAt(60), "Arrived", "at your door");
  assert.equal((await post("/v1/orders/practice-order/handover", { pin: "2468" })).status, 200);
  assert.equal(((await get("/v1/orders/practice-order")).order as { stage: string }).stage, "Settle");
  t.mock.restoreAll();

  // A shop in Kampala is the long way round, so it costs more to deliver.
  const kampala = await post("/v1/marketplace/checkout", { items: [{ storeId: "store_demo_fresh_mart", title: "Eggs", quantity: 1, price: 13_500 }] });
  assert.equal(((await kampala.json()) as { order: { delivery_fee: number } }).order.delivery_fee, 18_000);

  // Food: the dishes and their choices are priced from the menu.
  const menu = await get("/v1/restaurants/demo-food-lakeview/menu");
  const dish = menu.categories.flatMap((c: any) => c.items).find((i: any) => i.options?.length) as { id: string; price: number; options: Array<{ choices: Array<{ id: string; price_delta: number }> }> };
  const large = dish.options[0]!.choices.find((c) => c.price_delta > 0)!;
  const food = await post("/v1/restaurants/demo-food-lakeview/order", { items: [{ menuItemId: dish.id, quantity: 2, choiceIds: [large.id] }], destinationAddress: "Kitoro Road, Entebbe" });
  assert.equal(food.status, 201);
  const foodOrder = ((await food.json()) as { order: any }).order;
  assert.equal(foodOrder.restaurant_name, "Lakeview Kitchen");
  assert.equal(foodOrder.estimated_total, 2 * (dish.price + large.price_delta) + foodOrder.delivery_fee);
  assert.equal(foodOrder.stage, "Match");
  const detail = await get("/v1/orders/practice-order");
  assert.equal(detail.items[0].quantity, 2);

  // Not enough in the wallet: nothing is taken and the order is not paid.
  const huge = await post("/v1/restaurants/demo-food-lakeview/order", { items: [{ menuItemId: dish.id, quantity: 500 }] });
  assert.equal(huge.status, 201);
  const wallet = (await get("/v1/wallet")).balance as number;
  const declined = await post("/v1/orders/practice-order/fund", { paymentMethod: "wallet", useWallet: true });
  assert.equal(declined.status, 409);
  assert.equal(((await declined.json()) as { error: string }).error, "insufficient_funds");
  assert.equal((await get("/v1/wallet")).balance, wallet);
  assert.equal(((await get("/v1/orders/practice-order")).order as { stage: string }).stage, "Match");
});
