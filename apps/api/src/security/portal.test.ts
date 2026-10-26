import test from "node:test";
import assert from "node:assert/strict";
import { addAdmin, addUser, anonymous, app, freshDatabase } from "../test-support/db.js";

const json = async (res: Response) => (await res.json()) as any;
type Db = Awaited<ReturnType<typeof freshDatabase>>;

const as = (token: string) => (path: string, method = "GET", body?: object) =>
  app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

async function categoryId(client: Db): Promise<string> {
  const row = (await client.execute("SELECT id FROM merchant_categories WHERE active = 1 LIMIT 1")).rows[0] as any;
  return String(row.id);
}

const business = (categoryId: string, extra: object = {}) => ({
  legalName: "Kasule Traders Ltd", displayName: "Kasule Traders", categoryId, outletName: "Main shop", phone: "+256772000111", address: "Plot 4, Kampala", ...extra,
});
const store = (name = "Kasule Fresh") => ({ name, category: "groceries", description: "Fresh produce" });

async function signUp(phone = "+256772000111", name = "Ronald Kasule") {
  const res = await anonymous("/public/merchant-portal/register", "POST", { name, phone, password: "secret12" });
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  const body = await json(res);
  return { token: body.token as string, userId: body.user.id as string };
}

test("the portal config lists what is offered and what the sign-up needs", async () => {
  const client = await freshDatabase();
  const cfg = await json(await anonymous("/public/merchant-portal/config"));
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.features.sort(), ["app_listing", "web_store"]);
  assert.equal(cfg.accountCreation, "register_here");
  assert.equal(cfg.phoneCodeRequired, false, "no real SMS provider, so the phone code is not required");
  assert.ok(cfg.categories.length > 0);
  assert.equal(cfg.webDomain, "peebee.online");
  void client;
});

test("one account is made on the website and it is the same account the app uses", async () => {
  const client = await freshDatabase();
  const { token, userId } = await signUp();
  const me = await json(await as(token)("/auth/me"));
  assert.equal(me.user.id, userId);
  assert.equal(me.user.role, "customer");
  const dup = await anonymous("/public/merchant-portal/register", "POST", { name: "Again", phone: "+256772000111", password: "secret12" });
  assert.equal(dup.status, 409, "an existing account can't be registered twice");
  void client;
});

test("a merchant can choose merchant-only, app listing, a web store, or both", async () => {
  const client = await freshDatabase();
  const cat = await categoryId(client);

  const plain = await signUp("+256772000101");
  const a = await json(await as(plain.token)("/merchant-portal/apply", "POST", business(cat)));
  assert.equal(a.merchant.status, "pending_approval");
  assert.equal(a.store, null, "merchant-only makes no store");

  const web = await signUp("+256772000102");
  const b = await json(await as(web.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: false, webStore: true }, store: store("Web Only Shop") })));
  assert.equal(b.store.webStoreEnabled, true);
  assert.equal(b.store.listedInApp, false);
  assert.equal(b.store.status, "draft", "hidden until admin approves");
  assert.match(b.store.url, /^https:\/\/web-only-shop-[a-z0-9]{4}\.peebee\.online$/);

  const both = await signUp("+256772000103");
  const c = await json(await as(both.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: true, webStore: true }, store: store("Both Shop") })));
  assert.equal(c.store.listedInApp && c.store.webStoreEnabled, true);

  const row = (await client.execute("SELECT signup_channel FROM merchants LIMIT 1")).rows[0] as any;
  assert.equal(row.signup_channel, "portal");
});

test("one merchant per account, a store needs details, and a reserved name leaves nothing behind", async () => {
  const client = await freshDatabase();
  const cat = await categoryId(client);
  const u = await signUp();
  const call = as(u.token);
  assert.equal((await call("/merchant-portal/apply", "POST", business(cat, { features: { appListing: true, webStore: false } }))).status, 400, "a store needs its details");
  const reserved = await call("/merchant-portal/apply", "POST", business(cat, { features: { appListing: false, webStore: true }, store: store("Admin") }));
  assert.equal(reserved.status, 400);
  assert.equal((await json(reserved)).error, "reserved_name");
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM merchants")).rows[0].n), 0, "no half-made merchant");

  assert.equal((await call("/merchant-portal/apply", "POST", business(cat))).status, 201);
  assert.equal((await call("/merchant-portal/apply", "POST", business(cat))).status, 409);
  assert.equal((await anonymous("/merchant-portal/me")).status, 401);
});

test("admin decides what the website offers, whether accounts can be made there, and when stores go live", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const cat = await categoryId(client);
  const u = await signUp();

  await admin.setOptions({ merchant_portal_features: ["web_store"] });
  const off = await as(u.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: true, webStore: false }, store: store() }));
  assert.equal(off.status, 400);
  assert.equal((await json(off)).error, "feature_not_offered");

  await admin.setOptions({ merchant_portal_store_activation: "immediately" });
  const live = await json(await as(u.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: false, webStore: true }, store: store("Live Now") })));
  assert.equal(live.store.status, "active");

  await admin.setOptions({ merchant_portal_account_creation: "sign_in_only" });
  const closed = await anonymous("/public/merchant-portal/register", "POST", { name: "New", phone: "+256772000999", password: "secret12" });
  assert.equal(closed.status, 403);
  assert.equal((await json(closed)).error, "sign_in_only");

  await admin.setOptions({ merchant_portal_enabled: false });
  assert.equal((await anonymous("/public/merchant-portal/register", "POST", { name: "New", phone: "+256772000998", password: "secret12" })).status, 503);
  assert.equal((await as(u.token)("/merchant-portal/features", "PATCH", { webStore: true })).status, 503);
});

test("the options can be changed later, and a merchant-only account can add a store", async () => {
  const client = await freshDatabase();
  const cat = await categoryId(client);
  const u = await signUp();
  const call = as(u.token);
  await call("/merchant-portal/apply", "POST", business(cat));

  const needs = await call("/merchant-portal/features", "PATCH", { webStore: true });
  assert.equal(needs.status, 400, "adding a store needs its details");
  const added = await json(await call("/merchant-portal/features", "PATCH", { appListing: true, webStore: false, store: store("Added Later") }));
  assert.equal(added.store.listedInApp, true);
  assert.equal(added.store.webStoreEnabled, false);

  const toggled = await json(await call("/merchant-portal/features", "PATCH", { webStore: true, appListing: false }));
  assert.equal(toggled.store.webStoreEnabled, true);
  assert.equal(toggled.store.listedInApp, false);
  const me = await json(await call("/merchant-portal/me"));
  assert.equal(me.store.listedInApp, false);
});

test("a store made on the website is published when admin approves the merchant, and the switches decide where it shows", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const cat = await categoryId(client);
  const u = await signUp();
  const made = await json(await as(u.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: true, webStore: false }, store: store("Approve Me") })));
  const merchantId = made.merchant.id as string;
  const storeId = made.store.id as string;

  const listing = async () => ((await json(await anonymous("/marketplace/stores"))).stores as any[]).filter((s) => s.id === storeId);
  assert.equal((await listing()).length, 0, "a draft store is not shown to shoppers");

  const refused = await admin.call(`/admin/merchants/${merchantId}/status`, "POST", { status: "active" });
  assert.equal(refused.status, 409, "approval needs the documents first");
  await client.execute({ sql: "UPDATE merchants SET registration_number = 'REG1', tax_id = 'TIN1' WHERE id = ?", args: [merchantId] });
  await client.execute({ sql: "UPDATE merchant_kyc_cases SET owner_id_key = 'k1', business_document_key = 'k2' WHERE merchant_id = ?", args: [merchantId] });
  const approved = await admin.call(`/admin/merchants/${merchantId}/status`, "POST", { status: "active" });
  assert.equal(approved.status, 200, JSON.stringify(await approved.clone().json()));
  assert.equal(String(((await client.execute({ sql: "SELECT status FROM stores WHERE id = ?", args: [storeId] })).rows[0] as any).status), "active");
  assert.equal((await listing()).length, 1, "listed in the app once approved");

  await as(u.token)("/merchant-portal/features", "PATCH", { appListing: false });
  assert.equal((await listing()).length, 0, "switching app listing off removes it from app browsing");
});

test("orders on a store's own website are refused when its web store is off", async () => {
  const client = await freshDatabase();
  const cat = await categoryId(client);
  const owner = await signUp("+256772000555");
  const made = await json(await as(owner.token)("/merchant-portal/apply", "POST", business(cat, { features: { appListing: true, webStore: false }, store: store("App Only") })));
  const storeId = made.store.id as string;
  await client.execute({ sql: "UPDATE stores SET status = 'active' WHERE id = ?", args: [storeId] });
  await client.execute({ sql: "INSERT INTO store_products (id, store_id, title, price, inventory_quantity) VALUES ('p_portal', ?, 'Mango', 3000, 10)", args: [storeId] });

  const pub = await json(await anonymous(`/marketplace/stores/${storeId}`));
  assert.equal(Number(pub.store.web_store_enabled), 0, "the public store says whether it has a web store");

  const shopper = await addUser(client, "u_shopper");
  const quote = (channel: string) =>
    as(shopper)("/marketplace/checkout/quote", "POST", {
      items: [{ productId: "p_portal", storeId, title: "Mango", price: 1, quantity: 1 }],
      destinationLat: 0.31, destinationLng: 32.58, salesChannel: channel,
    });
  const web = await quote("dedicated_storefront");
  assert.equal(web.status, 403);
  assert.equal((await json(web)).error, "web_store_off");
  const inApp = await quote("customer_app");
  assert.notEqual((await json(inApp)).error, "web_store_off", "the app channel is not blocked by the web switch");

  await as(owner.token)("/merchant-portal/features", "PATCH", { webStore: true });
  assert.notEqual((await json(await quote("dedicated_storefront"))).error, "web_store_off");
});

test("the name check refuses reserved names", async () => {
  await freshDatabase();
  assert.equal((await json(await anonymous("/public/merchant-portal/name-check?name=Admin"))).ok, false);
  const ok = await json(await anonymous("/public/merchant-portal/name-check?name=Kasule%20Fresh"));
  assert.equal(ok.ok, true);
  assert.match(ok.addressPreview, /^kasule-fresh-xxxx\.peebee\.online$/);
});
