import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getDeliverySettings, getPharmacySettings, getPlatformEnvironment } from "../lib/settings.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";

/**
 * Prescriptions are medical records. The rules here:
 *  - a customer sees only their own;
 *  - only stores Peebee staff have approved as pharmacies can receive them;
 *  - a pharmacy sees only prescriptions addressed to its own store(s), and only
 *    its owner or managers (not cashiers or finance staff) can open them;
 *  - the doctor's slip lives in private storage and is only served to those two parties;
 *  - every change, and every time a pharmacy opens a slip, is recorded;
 *  - the quote total is computed here from the line items, never taken from the client.
 */
export const pharmacyRoutes = new Hono();
pharmacyRoutes.use("*", requireAuth);

type Row = Record<string, any>;

const PHARMACIST_ROLES = ["owner", "manager"];
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Everything below needs migration 0095 and 0097; until then it answers "upgrade pending". */
async function pharmacyReady(): Promise<boolean> {
  return (
    (await hasTable("pharmacy_prescriptions")) &&
    (await hasTable("pharmacy_prescription_events")) &&
    (await hasTable("pharmacy_approvals")) &&
    (await hasColumn("pharmacy_prescriptions", "reviewed_by")) &&
    (await hasColumn("pharmacy_prescriptions", "environment"))
  );
}

pharmacyRoutes.use("*", async (c, next) => {
  if (!(await pharmacyReady())) {
    return c.json({ error: "pharmacy_upgrade_pending", message: "Pharmacy is being upgraded. Try again shortly." }, 503);
  }
  const { enabled } = await getPharmacySettings();
  if (!enabled) return c.json({ error: "service_disabled", message: "Pharmacy prescriptions are switched off right now." }, 503);
  await next();
});

/** The approved pharmacy stores this user may act for: active owner/manager of the merchant that owns them. */
async function pharmaciesFor(userId: string): Promise<Row[]> {
  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.address, s.phone, s.merchant_id, m.role AS member_role, pa.licence_number
          FROM merchant_members m
          JOIN merchants mer ON mer.id = m.merchant_id
          JOIN stores s ON s.merchant_id = m.merchant_id
          JOIN pharmacy_approvals pa ON pa.store_id = s.id AND pa.status = 'approved'
          WHERE m.user_id = ? AND m.status = 'active' AND m.role IN ('owner', 'manager')
            AND mer.status = 'active' AND s.status = 'active'
          ORDER BY s.name`,
    args: [userId],
  });
  return res.rows as Row[];
}

async function logEvent(prescriptionId: string, actorId: string, kind: "customer" | "pharmacist", action: string, detail?: unknown) {
  await db.execute({
    sql: "INSERT INTO pharmacy_prescription_events (id, prescription_id, actor_id, actor_kind, action, detail) VALUES (?, ?, ?, ?, ?, ?)",
    args: [newId("rxe"), prescriptionId, actorId, kind, action, detail === undefined ? null : JSON.stringify(detail)],
  });
}

function parseItems(value: unknown): unknown[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serialize(r: Row) {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    pharmacyId: r.pharmacy_id,
    pharmacyName: r.pharmacy_name,
    hasImage: Boolean(r.prescription_image_url),
    imagePath: r.prescription_image_url ? `/v1/pharmacy/prescriptions/${r.id}/image` : null,
    patientNotes: r.patient_notes ?? "",
    patientAge: r.patient_age ?? null,
    patientGender: r.patient_gender ?? null,
    status: r.status,
    pharmacistNotes: r.pharmacist_notes ?? "",
    dosageInstructions: r.dosage_instructions ?? "",
    quotedItems: parseItems(r.quoted_items),
    quotedTotalUgx: Number(r.quoted_total_ugx ?? 0),
    deliveryAddress: r.delivery_address ?? "",
    deliveryFeeUgx: Number(r.delivery_fee_ugx ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Who am I? Lets the pharmacy app resolve the signed-in user to a pharmacy.
// ---------------------------------------------------------------------------

pharmacyRoutes.get("/me", async (c) => {
  const user = c.get("user");
  const stores = await pharmaciesFor(user.sub);
  if (stores.length === 0) {
    return c.json({ error: "not_a_pharmacist", message: "This account isn't linked to a pharmacy." }, 403);
  }
  return c.json({
    pharmacist: { id: user.sub, name: user.name, role: stores[0].member_role },
    pharmacy: { id: stores[0].id, name: stores[0].name, address: stores[0].address ?? "", phone: stores[0].phone ?? "", licenceNumber: stores[0].licence_number },
    pharmacies: stores.map((s) => ({ id: s.id, name: s.name })),
  });
});

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

/** Approved pharmacies a customer can send a prescription to. */
pharmacyRoutes.get("/pharmacies", async (c) => {
  const environment = await getPlatformEnvironment();
  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.address, s.phone FROM stores s JOIN pharmacy_approvals pa ON pa.store_id = s.id AND pa.status = 'approved'
          WHERE s.status = 'active' AND s.environment = ? ORDER BY s.name LIMIT 100`,
    args: [environment],
  });
  return c.json({ pharmacies: res.rows });
});

function imageExtension(bytes: Uint8Array): { ext: string; type: string } | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return { ext: "jpg", type: "image/jpeg" };
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", type: "image/png" };
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: "webp", type: "image/webp" };
  }
  return null;
}

/** Uploads a photo of the doctor's slip to private storage and returns its key. */
pharmacyRoutes.post("/uploads", async (c) => {
  const user = c.get("user");
  const { maxImageMb } = await getPharmacySettings();
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "missing_file", message: "Choose a photo of the prescription." }, 400);
  if (file.size > maxImageMb * 1024 * 1024) return c.json({ error: "file_too_large", message: `Photos can be up to ${maxImageMb} MB.` }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type.split(";")[0].trim().toLowerCase())) {
    return c.json({ error: "unsupported_file_type", message: "Use a JPEG, PNG or WebP photo." }, 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  // The declared type came from the client; the bytes decide.
  const detected = imageExtension(bytes);
  if (!detected) return c.json({ error: "unsupported_file_type", message: "That file isn't a valid photo." }, 400);

  const key = `rx/${user.sub}/${crypto.randomUUID()}.${detected.ext}`;
  await getR2Bucket().put(key, bytes, { httpMetadata: { contentType: detected.type } });
  return c.json({ key }, 201);
});

const submitSchema = z.object({
  pharmacyId: z.string().min(1).max(80),
  prescriptionImageKey: z.string().min(1).max(200),
  patientNotes: z.string().max(1000).optional(),
  patientAge: z.number().int().min(0).max(120).optional(),
  patientGender: z.enum(["female", "male", "other"]).optional(),
  deliveryAddress: z.string().max(200).optional(),
});

pharmacyRoutes.post("/prescriptions", async (c) => {
  const user = c.get("user");
  const parsed = submitSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  // Only a photo this customer uploaded can be attached.
  if (!d.prescriptionImageKey.startsWith(`rx/${user.sub}/`) || d.prescriptionImageKey.includes("..")) {
    return c.json({ error: "invalid_image", message: "Upload the prescription photo again." }, 400);
  }
  if (!(await getR2Bucket().get(d.prescriptionImageKey))) {
    return c.json({ error: "invalid_image", message: "Upload the prescription photo again." }, 400);
  }

  const { submissionsPerHour } = await getPharmacySettings();
  const limit = await consume(`rx-submit:${user.sub}`, submissionsPerHour, 3600);
  if (!limit.allowed) {
    return c.json({ error: "too_many_requests", message: "You've sent several prescriptions already. Try again later.", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  }

  const environment = await getPlatformEnvironment();
  const store = (
    await db.execute({
      sql: `SELECT s.id, s.name FROM stores s JOIN pharmacy_approvals pa ON pa.store_id = s.id AND pa.status = 'approved'
            WHERE s.id = ? AND s.status = 'active' AND s.environment = ?`,
      args: [d.pharmacyId, environment],
    })
  ).rows[0] as Row | undefined;
  if (!store) return c.json({ error: "pharmacy_not_found", message: "That pharmacy isn't available." }, 404);

  const account = (await db.execute({ sql: "SELECT name, phone FROM users WHERE id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  const { shoppingDeliveryFee } = await getDeliverySettings();
  const id = newId("rx");
  await db.execute({
    sql: `INSERT INTO pharmacy_prescriptions (id, customer_id, customer_name, customer_phone, pharmacy_id, pharmacy_name, prescription_image_url,
            patient_notes, patient_age, patient_gender, status, delivery_address, delivery_fee_ugx, environment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?)`,
    args: [id, user.sub, account?.name ?? user.name, account?.phone ?? null, store.id, store.name, d.prescriptionImageKey,
      d.patientNotes ?? "", d.patientAge ?? null, d.patientGender ?? null, d.deliveryAddress ?? "", Math.round(shoppingDeliveryFee), environment],
  });
  await logEvent(id, user.sub, "customer", "submitted");
  const row = (await db.execute({ sql: "SELECT * FROM pharmacy_prescriptions WHERE id = ?", args: [id] })).rows[0] as Row;
  return c.json({ ok: true, prescription: serialize(row) }, 201);
});

/** The signed-in customer's own prescriptions. */
pharmacyRoutes.get("/prescriptions", async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: "SELECT * FROM pharmacy_prescriptions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [user.sub],
  });
  return c.json({ prescriptions: (res.rows as Row[]).map(serialize) });
});

/** Cancels the customer's own prescription while it's still waiting or quoted. */
pharmacyRoutes.post("/prescriptions/:id/cancel", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const res = await db.execute({
    sql: `UPDATE pharmacy_prescriptions SET status = 'cancelled', updated_at = datetime('now')
          WHERE id = ? AND customer_id = ? AND status IN ('pending_review', 'priced_ready')`,
    args: [id, user.sub],
  });
  if ((res.rowsAffected ?? 0) !== 1) return c.json({ error: "not_found", message: "That prescription can't be cancelled." }, 404);
  await logEvent(id, user.sub, "customer", "cancelled").catch((err) => console.error("[pharmacy] audit write failed:", err));
  return c.json({ ok: true });
});

/** The slip photo: only the customer who uploaded it and the pharmacy it was sent to. */
pharmacyRoutes.get("/prescriptions/:id/image", async (c) => {
  const user = c.get("user");
  const row = (await db.execute({ sql: "SELECT id, customer_id, pharmacy_id, prescription_image_url FROM pharmacy_prescriptions WHERE id = ?", args: [c.req.param("id")] })).rows[0] as Row | undefined;
  if (!row || !row.prescription_image_url) return c.json({ error: "not_found" }, 404);

  let viewer: "customer" | "pharmacist" | null = row.customer_id === user.sub ? "customer" : null;
  if (!viewer && (await pharmaciesFor(user.sub)).some((s) => s.id === row.pharmacy_id)) viewer = "pharmacist";
  if (!viewer) return c.json({ error: "not_found" }, 404); // same answer as a missing one

  const object = await getR2Bucket().get(String(row.prescription_image_url));
  if (!object) return c.json({ error: "not_found" }, 404);
  if (viewer === "pharmacist") {
    await logEvent(String(row.id), user.sub, "pharmacist", "viewed_slip").catch((err) => console.error("[pharmacy] audit write failed:", err));
  }
  return new Response(object.body, {
    headers: { ...uploadResponseHeaders(object.httpMetadata?.contentType, "image/jpeg"), "Cache-Control": "private, no-store" },
  });
});

// ---------------------------------------------------------------------------
// Pharmacy side
// ---------------------------------------------------------------------------

/** Prescriptions addressed to this user's pharmacy store(s), oldest waiting first. */
pharmacyRoutes.get("/pharmacist/prescriptions", async (c) => {
  const user = c.get("user");
  const stores = await pharmaciesFor(user.sub);
  if (stores.length === 0) return c.json({ error: "not_a_pharmacist", message: "This account isn't linked to a pharmacy." }, 403);

  const status = c.req.query("status");
  const environment = await getPlatformEnvironment();
  const marks = stores.map(() => "?").join(", ");
  const res = await db.execute({
    sql: `SELECT * FROM pharmacy_prescriptions WHERE pharmacy_id IN (${marks}) AND environment = ? ${status ? "AND status = ?" : ""}
          ORDER BY CASE status WHEN 'pending_review' THEN 0 ELSE 1 END, created_at ASC LIMIT 100`,
    args: [...stores.map((s) => s.id), environment, ...(status ? [status] : [])],
  });
  return c.json({ prescriptions: (res.rows as Row[]).map(serialize) });
});

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  strength: z.string().max(40).optional(),
  dosage: z.string().max(160).optional(),
  quantity: z.number().int().min(1).max(100),
  unitPrice: z.number().int().min(0).max(10_000_000),
});

const reviewSchema = z.object({
  status: z.enum(["priced_ready", "declined", "dispensed"]),
  pharmacistNotes: z.string().max(1000).optional(),
  dosageInstructions: z.string().max(1000).optional(),
  quotedItems: z.array(itemSchema).max(30).optional(),
});

/** Which current states each decision may be made from. */
const ALLOWED_FROM: Record<"priced_ready" | "declined" | "dispensed", string[]> = {
  priced_ready: ["pending_review", "priced_ready"],
  declined: ["pending_review", "priced_ready"],
  dispensed: ["priced_ready"],
};

pharmacyRoutes.patch("/pharmacist/prescriptions/:id", async (c) => {
  const user = c.get("user");
  const stores = await pharmaciesFor(user.sub);
  if (stores.length === 0) return c.json({ error: "not_a_pharmacist", message: "This account isn't linked to a pharmacy." }, 403);

  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const id = c.req.param("id");
  const ids = stores.map((s) => s.id);
  const current = (await db.execute({ sql: `SELECT * FROM pharmacy_prescriptions WHERE id = ? AND pharmacy_id IN (${ids.map(() => "?").join(", ")})`, args: [id, ...ids] })).rows[0] as Row | undefined;
  if (!current) return c.json({ error: "not_found", message: "Prescription not found." }, 404);

  if (d.status === "priced_ready" && (!d.quotedItems || d.quotedItems.length === 0)) {
    return c.json({ error: "quote_required", message: "Add at least one medicine to the quote." }, 400);
  }
  const items = d.quotedItems ?? parseItems(current.quoted_items);
  // The total is the sum of the lines; any total the client sends is ignored.
  const total = d.status === "priced_ready"
    ? (d.quotedItems ?? []).reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
    : Number(current.quoted_total_ugx ?? 0);

  const allowed = ALLOWED_FROM[d.status];
  const res = await db.execute({
    sql: `UPDATE pharmacy_prescriptions SET status = ?, pharmacist_notes = COALESCE(?, pharmacist_notes), dosage_instructions = COALESCE(?, dosage_instructions),
            quoted_items = ?, quoted_total_ugx = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status IN (${allowed.map(() => "?").join(", ")})`,
    args: [d.status, d.pharmacistNotes ?? null, d.dosageInstructions ?? null, JSON.stringify(items), total, user.sub, id, ...allowed],
  });
  if ((res.rowsAffected ?? 0) !== 1) {
    return c.json({ error: "invalid_transition", message: `A ${String(current.status).replace("_", " ")} prescription can't be marked ${d.status.replace("_", " ")}.` }, 409);
  }
  await logEvent(id, user.sub, "pharmacist", d.status, { total, items: items.length }).catch((err) => console.error("[pharmacy] audit write failed:", err));

  const row = (await db.execute({ sql: "SELECT * FROM pharmacy_prescriptions WHERE id = ?", args: [id] })).rows[0] as Row;
  return c.json({ ok: true, prescription: serialize(row) });
});

// ---------------------------------------------------------------------------
// Peebee staff: approve a store as a pharmacy (and withdraw that approval)
// ---------------------------------------------------------------------------

pharmacyRoutes.use("/admin/*", requireRole("admin"));

pharmacyRoutes.get("/admin/pharmacies", requirePermission("merchants.view"), async (c) => {
  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.address, s.merchant_id, s.status AS store_status, pa.licence_number, pa.status AS approval_status, pa.approved_at
          FROM pharmacy_approvals pa JOIN stores s ON s.id = pa.store_id ORDER BY s.name LIMIT 200`,
    args: [],
  });
  return c.json({ pharmacies: res.rows });
});

pharmacyRoutes.post("/admin/pharmacies/:storeId/approve", requirePermission("merchants.manage"), async (c) => {
  const user = c.get("user");
  const storeId = c.req.param("storeId") as string;
  const parsed = z.object({ licenceNumber: z.string().min(4).max(60) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the pharmacy's licence number." }, 400);
  const store = (await db.execute({ sql: "SELECT id, name FROM stores WHERE id = ?", args: [storeId] })).rows[0] as Row | undefined;
  if (!store) return c.json({ error: "not_found", message: "Store not found." }, 404);

  await db.execute({
    sql: `INSERT INTO pharmacy_approvals (store_id, licence_number, status, approved_by) VALUES (?, ?, 'approved', ?)
          ON CONFLICT(store_id) DO UPDATE SET licence_number = excluded.licence_number, status = 'approved', approved_by = excluded.approved_by,
            approved_at = datetime('now'), updated_at = datetime('now')`,
    args: [storeId, parsed.data.licenceNumber.trim(), user.sub],
  });
  await logActivity({
    actor: user, action: "pharmacy.approve", summary: `Approved ${store.name} as a pharmacy (licence ${parsed.data.licenceNumber.trim()})`,
    entityType: "store", entityId: storeId, ip: c.req.header("cf-connecting-ip") ?? null,
  });
  return c.json({ ok: true });
});

pharmacyRoutes.post("/admin/pharmacies/:storeId/revoke", requirePermission("merchants.manage"), async (c) => {
  const user = c.get("user");
  const storeId = c.req.param("storeId") as string;
  const res = await db.execute({ sql: "UPDATE pharmacy_approvals SET status = 'revoked', updated_at = datetime('now') WHERE store_id = ? AND status = 'approved'", args: [storeId] });
  if ((res.rowsAffected ?? 0) !== 1) return c.json({ error: "not_found", message: "That store isn't an approved pharmacy." }, 404);
  await logActivity({
    actor: user, action: "pharmacy.revoke", summary: `Withdrew pharmacy approval for store ${storeId}`,
    entityType: "store", entityId: storeId, ip: c.req.header("cf-connecting-ip") ?? null,
  });
  return c.json({ ok: true });
});
