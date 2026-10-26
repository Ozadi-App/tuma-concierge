import test from "node:test";
import assert from "node:assert/strict";
import { addAdmin, addMerchantStore, addUser, anonymous, app, freshDatabase } from "../test-support/db.js";
import { setDomainLookupForTests } from "../lib/domains.js";
import { settleLoyalty } from "../marketplace/loyalty.js";
import { setSmsSenderForTests } from "../lib/sms-gateway.js";

const json = async (res: Response) => (await res.json()) as any;

test("reserved names and lookalikes cannot become stores", async () => {
  const client = await freshDatabase();
  for (const name of ["Login", "Pay ment", "Admin", "Peebee"]) {
    const user = await addUser(client, `u_res_${name.replace(/\W/g, "")}`);
    await client.execute({ sql: "INSERT INTO merchants (id, legal_name, display_name, business_kind, status, environment) VALUES (?, 'x', 'x', 'business', 'active', 'sandbox')", args: [`m_${name.replace(/\W/g, "")}`] });
    await client.execute({ sql: "INSERT INTO merchant_members (merchant_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')", args: [`m_${name.replace(/\W/g, "")}`, `u_res_${name.replace(/\W/g, "")}`] });
    const res = await app.request("/v1/merchants/me/store", { method: "POST", headers: { Authorization: `Bearer ${user}`, "Content-Type": "application/json" }, body: JSON.stringify({ name, category: "stores" }) });
    assert.equal(res.status, 400, `${name} is reserved`);
    assert.equal((await json(res)).error, "reserved_name");
  }
  const ok = await addMerchantStore(client, "u_res_fine", { slug: "Kampala Kettles" });
  assert.ok(ok.slug.startsWith("kampala-kettles"));
});

test("custom domains: off by default, verified by DNS, unique, and only then served", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const a = await addMerchantStore(client, "u_dom_a");
  const b = await addMerchantStore(client, "u_dom_b");

  const off = await a.call("/merchants/me/store", "PUT", { custom_domain: "shop.example.com" });
  assert.equal(off.status, 409, "the platform default is Peebee subdomains only");
  assert.equal((await json(off)).error, "custom_domains_disabled");

  await admin.setOptions({ storefront_domain_mode: "subdomain_plus_verified_custom_domains" });
  for (const bad of ["http://", "peebee.online", "evil.peebee.online", "localhost", "10.0.0.1", "not a domain", "a@b.com", "single"]) {
    assert.equal((await a.call("/merchants/me/store", "PUT", { custom_domain: bad })).status, 400, `${bad} is refused`);
  }
  const set = await a.call("/merchants/me/store", "PUT", { custom_domain: "https://Shop.Example.com/path" });
  assert.equal(set.status, 200);
  const mine = (await json(await a.call("/merchants/me/store"))).store;
  assert.equal(mine.custom_domain, "shop.example.com");
  assert.equal(Number(mine.domain_verified), 0);
  assert.ok(String(mine.domain_verify_token).length >= 16);

  assert.equal((await anonymous("/marketplace/stores/shop.example.com")).status, 404, "an unverified domain does not serve the store");
  const unverified = await json(await anonymous(`/marketplace/stores/${a.slug}`));
  assert.equal(unverified.store.custom_domain, null, "and is not advertised");
  assert.equal(unverified.channels.customDomainUrl, null);

  assert.equal((await b.call("/merchants/me/store", "PUT", { custom_domain: "shop.example.com" })).status, 409, "one store per domain");

  setDomainLookupForTests(async () => false);
  const notYet = await json(await a.call("/merchants/me/store/domain/verify", "POST", {}));
  assert.equal(notYet.verified, false);
  assert.equal(notYet.record.name, "_peebee-verify.shop.example.com");
  assert.equal(notYet.record.value, `peebee-verify=${mine.domain_verify_token}`);

  setDomainLookupForTests(async (domain, token) => domain === "shop.example.com" && token === mine.domain_verify_token);
  assert.equal((await json(await a.call("/merchants/me/store/domain/verify", "POST", {}))).verified, true);
  setDomainLookupForTests(null);

  const viaDomain = await json(await anonymous("/marketplace/stores/shop.example.com"));
  assert.equal(viaDomain.store.slug, a.slug);
  assert.equal(viaDomain.channels.customDomainUrl, "https://shop.example.com");

  // Changing the domain starts verification again; turning the platform option off stops serving it.
  await a.call("/merchants/me/store", "PUT", { custom_domain: "other.example.com" });
  assert.equal(Number((await json(await a.call("/merchants/me/store"))).store.domain_verified), 0);
  await a.call("/merchants/me/store", "PUT", { custom_domain: "" });
  assert.equal((await json(await a.call("/merchants/me/store"))).store.custom_domain, null);
});

test("promo codes: private stay private, visibility is an admin option, expiry and limits hold", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const seller = await addMerchantStore(client, "u_promo_seller");
  await client.execute({ sql: "INSERT INTO store_products (id, store_id, title, price) VALUES ('p_promo', ?, 'Kettle', 50000)", args: [seller.storeId] });
  const mk = (code: string, extra: object = {}) => seller.call("/merchants/me/discounts", "POST", { code, title: `${code} offer`, kind: "percent", value: 10, min_order_amount: 0, ...extra });
  assert.equal((await mk("SECRET10")).status, 201);
  assert.equal((await mk("SHOWN10", { is_public: true })).status, 201);
  assert.equal((await mk("AUTO5", { is_automatic: true, value: 5 })).status, 201);
  assert.equal((await mk("OLD10", { expires_at: new Date(Date.now() - 86400000).toISOString() })).status, 201);
  assert.equal((await mk("ONCE", { max_uses: 1 })).status, 201);

  const listed = async () => (await json(await anonymous(`/marketplace/stores/${seller.slug}`))).discounts.map((d: any) => d.code).sort();
  assert.deepEqual(await listed(), ["AUTO5"], "default: automatic offers only");
  await admin.setOptions({ storefront_promo_visibility: "flagged_public" });
  assert.deepEqual(await listed(), ["AUTO5", "SHOWN10"], "merchant-flagged codes are listed too");
  await admin.setOptions({ storefront_promo_visibility: "none_public" });
  assert.deepEqual(await listed(), []);

  const check = (code: string, quantity = 2) => anonymous(`/marketplace/stores/${seller.slug}/promo-check`, "POST", { code, items: [{ productId: "p_promo", quantity }] });
  const secret = await json(await check("secret10"));
  assert.equal(secret.valid, true, "a private code still works when typed");
  assert.equal(secret.subtotal, 100000);
  assert.equal(secret.amount, 10000);
  assert.equal((await json(await check("NOPE"))).valid, false);
  assert.equal((await json(await check("OLD10"))).valid, false, "expired");
  assert.equal((await check("SECRET10", 0)).status, 400);
  assert.equal((await anonymous(`/marketplace/stores/${seller.slug}/promo-check`, "POST", { code: "X", items: [{ productId: "ghost", quantity: 1 }] })).status, 400, "priced from the catalogue");

  // A limited code is claimed atomically at checkout.
  const shopper = await addUser(client, "u_promo_shopper");
  const buy = () => app.request("/v1/marketplace/checkout", {
    method: "POST", headers: { Authorization: `Bearer ${shopper}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ productId: "p_promo", storeId: seller.storeId, title: "", price: 1, quantity: 1 }], paymentRail: "escrow", promoCode: "once" }),
  });
  const first = await buy();
  assert.equal(first.status, 201);
  assert.equal((await json(first)).orders[0].estimated_total - (await json(await buy())).orders[0].delivery_fee > 0, true);
  const uses = await client.execute("SELECT uses_count FROM store_discounts WHERE code = 'ONCE'");
  assert.equal(Number(uses.rows[0].uses_count), 1, "the second order did not get the used-up code");
});

test("loyalty cashback is credited when the admin-chosen moment arrives, once", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const seller = await addMerchantStore(client, "u_loy_seller");
  await client.execute({ sql: "UPDATE stores SET loyalty_enabled = 1, loyalty_cashback_percent = 10 WHERE id = ?", args: [seller.storeId] });
  await client.execute({ sql: "INSERT INTO store_products (id, store_id, title, price) VALUES ('p_loy', ?, 'Kettle', 50000)", args: [seller.storeId] });
  const shopperToken = await addUser(client, "u_loy_shopper", "customer", { phone: "+256700555123" });
  const buy = async () => {
    const res = await app.request("/v1/marketplace/checkout", {
      method: "POST", headers: { Authorization: `Bearer ${shopperToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: "p_loy", storeId: seller.storeId, title: "", price: 0, quantity: 1 }], paymentRail: "escrow" }),
    });
    assert.equal(res.status, 201);
    return (await json(res)).orders[0].id as string;
  };
  const balance = async () => Number((await client.execute("SELECT COALESCE(SUM(points_balance_ugx), 0) AS b FROM store_customer_loyalty")).rows[0].b);

  // Default: delivered and settled.
  const o1 = await buy();
  assert.equal(await balance(), 0, "nothing is credited just for placing an order");
  assert.equal((await client.execute({ sql: "SELECT status FROM store_loyalty_events WHERE order_id = ?", args: [o1] })).rows[0].status, "pending");
  await client.execute({ sql: "UPDATE orders SET stage = 'Shop' WHERE id = ?", args: [o1] });
  await settleLoyalty();
  assert.equal(await balance(), 0, "paid but not delivered: still waiting");
  await client.execute({ sql: "UPDATE orders SET stage = 'Settle' WHERE id = ?", args: [o1] });
  assert.equal(await settleLoyalty(), 1);
  assert.equal(await balance(), 5000, "10% of 50,000");
  assert.equal(await settleLoyalty(), 0);
  assert.equal(await balance(), 5000, "never credited twice");

  const o2 = await buy();
  await client.execute({ sql: "UPDATE orders SET stage = 'Cancelled' WHERE id = ?", args: [o2] });
  await settleLoyalty();
  assert.equal(await balance(), 5000, "a cancelled order earns nothing");
  assert.equal((await client.execute({ sql: "SELECT status FROM store_loyalty_events WHERE order_id = ?", args: [o2] })).rows[0].status, "void");

  // Payment confirmed: credited once the order is paid, before delivery.
  await admin.setOptions({ loyalty_credit_trigger: "on_payment_confirmed" });
  const o3 = await buy();
  await settleLoyalty();
  assert.equal(await balance(), 5000, "unpaid orders (Create/Match/Fund) wait");
  await client.execute({ sql: "UPDATE orders SET stage = 'Shop', payment_rail = 'escrow' WHERE id = ?", args: [o3] });
  await settleLoyalty();
  assert.equal(await balance(), 10000);

  // As placed: the old behaviour, immediately.
  await admin.setOptions({ loyalty_credit_trigger: "on_order_placed" });
  await buy();
  assert.equal(await balance(), 15000);
});

test("stores that are not live say so (or hide), by admin option; storefront options reach the page", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const seller = await addMerchantStore(client, "u_stale");
  const paused = await addMerchantStore(client, "u_stale2", { status: "suspended" });
  const gone = await anonymous(`/marketplace/stores/${paused.slug}`);
  assert.equal(gone.status, 410);
  assert.equal((await json(gone)).error, "store_unavailable");
  assert.equal((await anonymous("/marketplace/stores/no-such-store")).status, 404);
  await admin.setOptions({ storefront_stale_status_behavior: "not_found" });
  assert.equal((await anonymous(`/marketplace/stores/${paused.slug}`)).status, 404);

  await client.execute({ sql: "UPDATE stores SET meta_pixel_id = '1234567890', tiktok_pixel_id = '<script>alert(1)</script>' WHERE id = ?", args: [seller.storeId] });
  const body = await json(await anonymous(`/marketplace/stores/${seller.slug}`));
  assert.equal(body.storefront.checkoutMode, "handoff_to_app");
  assert.equal(body.storefront.metaPixelId, "1234567890");
  assert.equal(body.storefront.tiktokPixelId, null, "a malformed pixel id is never passed to the page");
  await admin.setOptions({ storefront_pixels_enabled: false });
  assert.equal((await json(await anonymous(`/marketplace/stores/${seller.slug}`))).storefront.metaPixelId, null);
  assert.ok(!JSON.stringify(body.store).includes("pixel"), "raw pixel columns are not in the store object");
});

test("phone code: texted, checked, bound to the phone, and required by the forms admin protects", async () => {
  const client = await freshDatabase();
  const admin = await addAdmin(client);
  const seller = await addMerchantStore(client, "u_otp_seller");
  await client.execute({ sql: "INSERT INTO store_products (id, store_id, title, price) VALUES ('p_otp', ?, 'Rice', 20000)", args: [seller.storeId] });
  const inquiry = (headers: Record<string, string> = {}) => anonymous(`/marketplace/stores/${seller.slug}/b2b-inquiry`, "POST", {
    customer_name: "Acme Ltd", customer_phone: "0700111222", items: [{ productId: "p_otp", title: "Rice", unitPrice: 1, quantity: 10 }],
  }, headers);

  assert.equal((await anonymous("/public/phone-proof/request", "POST", { phone: "0700111222", purpose: "b2b_inquiry" })).status, 503, "no real SMS provider yet");
  const early = await admin.call("/admin/option-settings", "PATCH", { values: { storefront_b2b_inquiry_protection: "phone_otp" } });
  assert.equal(early.status, 400, "cannot be chosen until a real SMS provider is connected");
  assert.match((await json(early)).errors.storefront_b2b_inquiry_protection, /SMS provider/);
  assert.equal((await inquiry()).status, 201, "the stored default is the phone code, which falls back to rate limiting until SMS is real");

  const texts: Array<{ to: string; body: string }> = [];
  setSmsSenderForTests(async (to, body) => { texts.push({ to, body }); return { status: "sent", provider: "africas_talking", externalId: "m1" }; });
  try {
    assert.equal((await inquiry()).status, 403, "now a phone code is required");
    const req = await json(await anonymous("/public/phone-proof/request", "POST", { phone: "0700111222", purpose: "b2b_inquiry" }));
    assert.ok(req.challenge && !("code" in req), "the code is texted, never returned");
    assert.equal(texts.length, 1);
    assert.equal(texts[0].to, "+256700111222");
    const code = /(\d{6})/.exec(texts[0].body)![1];
    const wrong = await anonymous("/public/phone-proof/verify", "POST", { challenge: req.challenge, code: code === "123456" ? "654321" : "123456" });
    assert.equal(wrong.status, 400);
    const ok = await json(await anonymous("/public/phone-proof/verify", "POST", { challenge: req.challenge, code }));
    assert.ok(ok.proof);
    assert.equal((await inquiry({ "x-phone-proof": ok.proof })).status, 201, "the proof opens the form");
    const other = await anonymous(`/marketplace/stores/${seller.slug}/b2b-inquiry`, "POST", {
      customer_name: "Mallory", customer_phone: "0700999888", items: [{ productId: "p_otp", title: "Rice", unitPrice: 1, quantity: 10 }],
    }, { "x-phone-proof": ok.proof });
    assert.equal(other.status, 403, "a proof for one phone does not work for another");

    // A challenge allows five guesses.
    const r2 = await json(await anonymous("/public/phone-proof/request", "POST", { phone: "0700333444", purpose: "service_booking" }));
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await anonymous("/public/phone-proof/verify", "POST", { challenge: r2.challenge, code: "000000" })).status;
    assert.equal(last, 429);
  } finally {
    setSmsSenderForTests(null);
  }
});

test("merchant texts are logged honestly and billed only when a provider accepted them", async () => {
  const client = await freshDatabase();
  const seller = await addMerchantStore(client, "u_sms_seller");
  const send = () => seller.call("/merchants/me/send-sms", "POST", { recipient_phone: "0700123123", body: "Your order is ready", message_type: "dispatch_alert" });

  const sim = await json(await send());
  assert.equal(sim.status, "simulated");
  assert.equal(sim.costUgx, 0, "nothing left the building, nothing is charged");

  setSmsSenderForTests(async () => ({ status: "sent", provider: "africas_talking", externalId: "AT-1" }));
  const sent = await json(await send());
  assert.equal(sent.status, "delivered");
  assert.ok(sent.costUgx > 0);
  assert.equal(sent.externalMessageId, "AT-1");

  setSmsSenderForTests(async () => ({ status: "failed", provider: "africas_talking", error: "no balance" }));
  const failed = await send();
  const failedBody = await json(failed);
  assert.equal(failedBody.status, "failed");
  assert.equal(failedBody.ok, false);
  assert.equal(failedBody.costUgx, 0);
  setSmsSenderForTests(null);

  const logs = await client.execute("SELECT status, cost_ugx FROM store_sms_logs ORDER BY created_at");
  assert.deepEqual(logs.rows.map((r) => [r.status, Number(r.cost_ugx) > 0]), [["simulated", false], ["delivered", true], ["failed", false]]);
});

test("page sections hold only what the merchant wrote, validated; nothing is invented", async () => {
  const client = await freshDatabase();
  const seller = await addMerchantStore(client, "u_sec_seller");
  const put = (sections: unknown) => seller.call("/merchants/me/storefront-sections", "PUT", { sections });
  const base = { enabled: true, order: 1 };

  const fresh = await json(await anonymous(`/marketplace/stores/${seller.slug}`));
  for (const sec of fresh.sections.filter((s: any) => ["testimonials", "trust_badges", "faq"].includes(s.type))) {
    assert.deepEqual(sec.settings.items, [], `${sec.type} starts empty, no made-up reviews or promises`);
  }

  assert.equal((await put([])).status, 400);
  assert.equal((await put([{ ...base, id: "a", type: "script", title: "x" }])).status, 400, "unknown type");
  assert.equal((await put([{ ...base, id: "a", type: "video_spotlight", title: "Reel", settings: { videoUrl: "javascript:alert(1)" } }])).status, 400, "no javascript: links");
  assert.equal((await put([{ ...base, id: "a", type: "faq", title: "FAQ", settings: { items: [{ question: "", answer: "x" }] } }])).status, 400, "blank question");
  assert.equal((await put(Array.from({ length: 21 }, (_, i) => ({ ...base, id: `s${i}`, type: "hero", title: "x" })))).status, 400, "too many sections");

  const ok = await put([
    { ...base, id: "sec_faq", type: "faq", title: "Questions", settings: { items: [{ question: "Do you deliver?", answer: "Yes, across Kampala.", evil: "<script>" }], onclick: "x()" } },
    { ...base, id: "sec_rev", type: "testimonials", title: "Kind words", order: 2, settings: { items: [{ quote: "Great kettle", author: "Ann · Ntinda", rating: 5 }] } },
  ]);
  assert.equal(ok.status, 200);
  const stored = JSON.parse(String((await client.execute({ sql: "SELECT theme_sections FROM stores WHERE id = ?", args: [seller.storeId] })).rows[0].theme_sections));
  assert.ok(!JSON.stringify(stored).includes("evil") && !JSON.stringify(stored).includes("onclick"), "unknown keys are dropped");

  // What was already stored by an older version is cleaned on the way out as well.
  await client.execute({ sql: "UPDATE stores SET theme_sections = ? WHERE id = ?", args: [JSON.stringify([
    { id: "old", type: "video_spotlight", title: "Old", enabled: true, order: 1, settings: { videoUrl: "javascript:alert(1)" } },
    { id: "bad", type: "mystery", title: "Bad", enabled: true, order: 2 },
    { id: "good", type: "faq", title: "FAQ", enabled: true, order: 3, settings: { items: [{ question: "Q", answer: "A" }] } },
  ]), seller.storeId] });
  const pub = await json(await anonymous(`/marketplace/stores/${seller.slug}`));
  assert.deepEqual(pub.sections.map((s: any) => s.id), ["old", "good"], "unknown section types are dropped");
  assert.equal(pub.sections[0].settings.videoUrl, undefined, "an unsafe link is dropped from an old page");
});

test("an unchanged domain can be saved again (and a malformed pixel id cannot)", async () => {
  const client = await freshDatabase();
  const seller = await addMerchantStore(client, "u_dom_same");
  await client.execute({ sql: "UPDATE stores SET custom_domain = 'legacy.example.com' WHERE id = ?", args: [seller.storeId] });
  const same = await seller.call("/merchants/me/store", "PUT", { custom_domain: "legacy.example.com", hero_headline: "Hello" });
  assert.equal(same.status, 200, "platform has domains off, but re-saving the theme with the same value is not an error");
  assert.equal((await seller.call("/merchants/me/store", "PUT", { meta_pixel_id: "abc'); alert(1);//" })).status, 400);
  assert.equal((await seller.call("/merchants/me/store", "PUT", { tiktok_pixel_id: "<script>" })).status, 400);
  assert.equal((await seller.call("/merchants/me/store", "PUT", { meta_pixel_id: "1234567890", tiktok_pixel_id: "c0abcdef123" })).status, 200);
  const row = (await client.execute({ sql: "SELECT tiktok_pixel_id FROM stores WHERE id = ?", args: [seller.storeId] })).rows[0];
  assert.equal(row.tiktok_pixel_id, "C0ABCDEF123", "stored in the shape the page expects");
});
