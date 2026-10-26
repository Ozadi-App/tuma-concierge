import { Hono } from "hono";
import { z } from "zod";
import { authRoutes } from "../auth/routes.js";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { publicRateLimit } from "../lib/guards.js";
import { getOptions } from "../lib/option-settings.js";
import { proofIsValid } from "../lib/phone-proof.js";
import { hasColumn } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { normalizePhone } from "../lib/validation.js";
import { createMerchantBusiness } from "../merchants/service.js";
import { createStoreForMerchant, slugify, type NewStore } from "../marketplace/store-create.js";

type Row = Record<string, unknown>;

/**
 * The sign-up website for merchants (stores.peebee.online). It has no data of its own: it writes the same merchant,
 * outlet and store rows the merchant app and the customer app read, so everything stays in sync. What the merchant
 * chooses on the website is two switches on the store row: shown in the app, and its own web store.
 */
export const merchantPortalRoutes = new Hono();

const MIGRATION = "0141_merchant_portal.sql";
const WEB_DOMAIN = "peebee.online";

/** The portal writes the channel switches, so it waits for migration 0141 (answers 503 until it is applied). */
async function pendingMigration(c: { json: (b: object, s: 503) => Response }): Promise<Response | null> {
  if ((await hasColumn("stores", "listed_in_app")) && (await hasColumn("stores", "web_store_enabled")) && (await hasColumn("merchants", "signup_channel"))) return null;
  return c.json({ error: "migration_pending", message: `This feature is being set up (${MIGRATION} is not applied yet). Try again shortly.` }, 503);
}

async function portalSettings() {
  const o = await getOptions([
    "merchant_portal_enabled", "merchant_portal_features", "merchant_portal_account_creation",
    "merchant_portal_phone_check", "merchant_portal_store_activation",
  ]);
  return {
    enabled: o.merchant_portal_enabled === true,
    features: o.merchant_portal_features as string[],
    accountCreation: String(o.merchant_portal_account_creation),
    phoneCheck: String(o.merchant_portal_phone_check),
    storeActivation: String(o.merchant_portal_store_activation),
  };
}

const closed = (c: { json: (b: object, s: 503) => Response }) =>
  c.json({ error: "portal_closed", message: "Merchant sign-up on the website is paused right now." }, 503);

merchantPortalRoutes.get("/public/merchant-portal/config", async (c) => {
  const s = await portalSettings();
  const categories = (await db.execute("SELECT id, name FROM merchant_categories WHERE active = 1 ORDER BY sort_order, name")).rows;
  return c.json({
    enabled: s.enabled,
    accountCreation: s.accountCreation,
    phoneCodeRequired: s.phoneCheck === "phone_code",
    features: s.features,
    categories,
    storeCategories: [{ id: "groceries", name: "Groceries & fresh food" }, { id: "stores", name: "General stores" }],
    webDomain: WEB_DOMAIN,
  });
});

merchantPortalRoutes.get("/public/merchant-portal/name-check", async (c) => {
  const name = (c.req.query("name") ?? "").trim();
  if (name.length < 2) return c.json({ ok: false, message: "Enter at least 2 characters." });
  const base = slugify(name);
  if (!base) return c.json({ ok: false, message: "Use letters or numbers in the name." });
  const reserved = ((await getOptions(["storefront_reserved_subdomains"])).storefront_reserved_subdomains as string[]) ?? [];
  const compact = base.replace(/-/g, "");
  if (reserved.some((r) => r === base || r.replace(/-/g, "") === compact)) {
    return c.json({ ok: false, message: "That name could be mistaken for a Peebee page. Choose another." });
  }
  return c.json({ ok: true, addressPreview: `${base}-xxxx.${WEB_DOMAIN}`, message: "Your web address is this name plus 4 letters or numbers that make it yours." });
});

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  email: z.string().email().max(160).optional().or(z.literal("")),
  password: z.string().min(6).max(100),
});

/** Make a Peebee account on the website. The same account works in every Peebee app. */
merchantPortalRoutes.post("/public/merchant-portal/register", async (c) => {
  const s = await portalSettings();
  if (!s.enabled) return closed(c);
  if (s.accountCreation !== "register_here") {
    return c.json({ error: "sign_in_only", message: "Sign in with your Peebee account to continue." }, 403);
  }
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return c.json({ error: "invalid_phone", message: "Enter a valid phone number." }, 400);
  if (s.phoneCheck === "phone_code" && !(await proofIsValid(c.req.header("x-phone-proof"), phone, "merchant_portal"))) {
    return c.json({ error: "phone_proof_required", message: "Confirm your phone number with the code we text you, then try again." }, 403);
  }
  // The normal sign-up does the rest (duplicate check, password hash, account code, rate limit), so the website
  // account is exactly the account the app makes.
  const forwarded: Record<string, string> = { "Content-Type": "application/json" };
  for (const h of ["cf-connecting-ip", "x-forwarded-for", "user-agent"]) {
    const v = c.req.header(h);
    if (v) forwarded[h] = v;
  }
  const res = await authRoutes.request("/register", {
    method: "POST",
    headers: forwarded,
    body: JSON.stringify({ name: parsed.data.name, phone, email: parsed.data.email || undefined, password: parsed.data.password, role: "customer" }),
  });
  const body = (await res.json().catch(() => ({}))) as Row;
  if (res.status !== 201) return c.json(body, res.status as 400 | 409 | 429);
  return c.json({ token: body.token, user: body.user }, 201);
});

/* ------------------------------------------------------------------ signed in */

const storeSchema = z.object({
  name: z.string().min(2).max(60),
  category: z.enum(["groceries", "stores"]),
  description: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(240).optional(),
});

const applySchema = z.object({
  legalName: z.string().min(2).max(160),
  displayName: z.string().min(2).max(120),
  categoryId: z.string().min(1),
  outletName: z.string().min(2).max(120),
  phone: z.string().min(6).max(20).optional(),
  address: z.string().max(240).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  features: z.object({ appListing: z.boolean().default(false), webStore: z.boolean().default(false) }).default({ appListing: false, webStore: false }),
  store: storeSchema.optional(),
});

async function ownedMerchant(userId: string): Promise<Row | null> {
  const res = await db.execute({
    sql: `SELECT m.*, mm.role AS member_role FROM merchant_members mm JOIN merchants m ON m.id = mm.merchant_id
          WHERE mm.user_id = ? AND mm.status = 'active' AND mm.role = 'owner' ORDER BY m.created_at LIMIT 1`,
    args: [userId],
  });
  return (res.rows[0] as Row | undefined) ?? null;
}

const featureOffered = (offered: string[], f: "appListing" | "webStore") => offered.includes(f === "appListing" ? "app_listing" : "web_store");

function storeUrl(slug: string): string {
  return `https://${slug}.${WEB_DOMAIN}`;
}

async function describe(merchant: Row) {
  const store = (await db.execute({ sql: "SELECT * FROM stores WHERE merchant_id = ? LIMIT 1", args: [String(merchant.id)] })).rows[0] as Row | undefined;
  const kyc = (await db.execute({
    sql: "SELECT status, owner_id_key, business_document_key FROM merchant_kyc_cases WHERE merchant_id = ?", args: [String(merchant.id)],
  })).rows[0] as Row | undefined;
  const hasListedCol = await hasColumn("stores", "listed_in_app");
  const hasWebCol = await hasColumn("stores", "web_store_enabled");
  const documents = {
    registrationNumber: !!merchant.registration_number,
    taxId: !!merchant.tax_id,
    ownerId: !!kyc?.owner_id_key,
    businessRegistration: !!kyc?.business_document_key,
  };
  const complete = Object.values(documents).every(Boolean);
  const nextSteps: string[] = [];
  if (!complete) nextSteps.push("Add your registration number, tax ID and the two documents so we can approve your business.");
  else if (merchant.status !== "active") nextSteps.push("We're reviewing your business. You'll be approved once the checks are done.");
  if (store && store.status === "draft") nextSteps.push("Your store goes live as soon as your business is approved.");
  return {
    merchant: { id: merchant.id, displayName: merchant.display_name, legalName: merchant.legal_name, status: merchant.status, kyc: kyc?.status ?? "not_started" },
    documents,
    store: store
      ? {
          id: store.id, name: store.name, slug: store.slug, status: store.status,
          listedInApp: hasListedCol ? Number(store.listed_in_app) === 1 : true,
          webStoreEnabled: hasWebCol ? Number(store.web_store_enabled) === 1 : true,
          url: storeUrl(String(store.slug)),
        }
      : null,
    nextSteps,
  };
}

merchantPortalRoutes.post("/merchant-portal/apply", requireAuth, async (c) => {
  const user = c.get("user");
  const s = await portalSettings();
  if (!s.enabled) return closed(c);
  const pending = await pendingMigration(c);
  if (pending) return pending;
  const parsed = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const limited = await publicRateLimit(c, "portal-apply", user.sub, "rate_limit_public_inquiry_per_hour", 3600);
  if (limited) return limited;
  if (await ownedMerchant(user.sub)) {
    return c.json({ error: "already_a_merchant", message: "This account already has a merchant business. Open your dashboard to change its options." }, 409);
  }
  for (const f of ["appListing", "webStore"] as const) {
    if (d.features[f] && !featureOffered(s.features, f)) {
      return c.json({ error: "feature_not_offered", message: "That option isn't available right now." }, 400);
    }
  }
  const wantsStore = d.features.appListing || d.features.webStore;
  if (wantsStore && !d.store) return c.json({ error: "store_details_required", message: "Tell us your store's name and what it sells." }, 400);
  const category = await db.execute({ sql: "SELECT id FROM merchant_categories WHERE id = ? AND active = 1", args: [d.categoryId] });
  if (!category.rows[0]) return c.json({ error: "invalid_category", message: "Choose a business category." }, 400);

  // Check the store name before anything is written, so a refused name leaves no half-made merchant.
  if (wantsStore && d.store) {
    const base = slugify(d.store.name);
    const reserved = ((await getOptions(["storefront_reserved_subdomains"])).storefront_reserved_subdomains as string[]) ?? [];
    const compact = base.replace(/-/g, "");
    if (!base || reserved.some((r) => r === base || r.replace(/-/g, "") === compact)) {
      return c.json({ error: "reserved_name", message: "That store name can't be used because it could be mistaken for a Peebee page. Please choose another name." }, 400);
    }
  }

  const environment = await getPlatformEnvironment();
  const created = await createMerchantBusiness({
    ownerId: user.sub, legalName: d.legalName, displayName: d.displayName, businessKind: "business", categoryId: d.categoryId,
    outletName: d.outletName, phone: d.phone, address: d.address, lat: d.lat, lng: d.lng, environment,
  });
  await db.execute({ sql: "UPDATE merchants SET signup_channel = 'portal' WHERE id = ?", args: [created.merchantId] });

  if (wantsStore && d.store) {
    const made = await createStoreForMerchant(created.merchantId, d.store as NewStore, {
      status: s.storeActivation === "immediately" ? "active" : "draft",
      listedInApp: d.features.appListing,
      webStoreEnabled: d.features.webStore,
    });
    if (!made.ok) return c.json({ error: made.error, message: made.message }, 400);
  }
  const merchant = (await db.execute({ sql: "SELECT * FROM merchants WHERE id = ?", args: [created.merchantId] })).rows[0] as Row;
  return c.json({ ok: true, ...(await describe(merchant)) }, 201);
});

merchantPortalRoutes.get("/merchant-portal/me", requireAuth, async (c) => {
  const merchant = await ownedMerchant(c.get("user").sub);
  if (!merchant) return c.json({ merchant: null, store: null, nextSteps: [], offered: (await portalSettings()).features });
  return c.json({ ...(await describe(merchant)), offered: (await portalSettings()).features });
});

const featuresSchema = z.object({
  appListing: z.boolean().optional(),
  webStore: z.boolean().optional(),
  store: storeSchema.optional(),
});

/** Switch the app listing or the web store on or off later, or add a store to a merchant-only account. */
merchantPortalRoutes.patch("/merchant-portal/features", requireAuth, async (c) => {
  const user = c.get("user");
  const s = await portalSettings();
  if (!s.enabled) return closed(c);
  const pending = await pendingMigration(c);
  if (pending) return pending;
  const merchant = await ownedMerchant(user.sub);
  if (!merchant) return c.json({ error: "not_a_merchant", message: "Register your business first." }, 404);
  const parsed = featuresSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  for (const f of ["appListing", "webStore"] as const) {
    if (d[f] === true && !featureOffered(s.features, f)) return c.json({ error: "feature_not_offered", message: "That option isn't available right now." }, 400);
  }

  const existing = (await db.execute({ sql: "SELECT * FROM stores WHERE merchant_id = ? LIMIT 1", args: [String(merchant.id)] })).rows[0] as Row | undefined;
  if (!existing) {
    if (d.appListing !== true && d.webStore !== true) return c.json({ ok: true, ...(await describe(merchant)) });
    if (!d.store) return c.json({ error: "store_details_required", message: "Tell us your store's name and what it sells." }, 400);
    const live = merchant.status === "active" || s.storeActivation === "immediately";
    const made = await createStoreForMerchant(String(merchant.id), d.store as NewStore, {
      status: live ? "active" : "draft", listedInApp: d.appListing === true, webStoreEnabled: d.webStore === true,
    });
    if (!made.ok) return c.json({ error: made.error, message: made.message }, 400);
  } else {
    const sets: string[] = [];
    const args: Array<number | string> = [];
    if (d.appListing !== undefined) { sets.push("listed_in_app = ?"); args.push(d.appListing ? 1 : 0); }
    if (d.webStore !== undefined) { sets.push("web_store_enabled = ?"); args.push(d.webStore ? 1 : 0); }
    if (sets.length) await db.execute({ sql: `UPDATE stores SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`, args: [...args, String(existing.id)] });
  }
  return c.json({ ok: true, ...(await describe(merchant)) });
});
