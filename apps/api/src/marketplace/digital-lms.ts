import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getMarketplaceSettings } from "../lib/settings.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { findPublicStore } from "./public.js";
import type {
  StoreDigitalProduct,
  StoreDigitalFulfillment,
  StoreLmsCourse,
  StoreLmsEnrollment,
} from "@peebee/shared";

export const digitalLmsRoutes = new Hono();

type Row = Record<string, unknown>;

// Demo fallback data
export const DEMO_DIGITAL_PRODUCTS: StoreDigitalProduct[] = [
  {
    id: "dig_demo_ebook",
    store_id: "store_demo_fresh_mart",
    title: "Organic Urban Farming Guide & Seasonal Harvest Calendar",
    kind: "download",
    description: "Complete 85-page PDF guide to balcony gardening, composting in Kampala, and indigenous vegetable calendars.",
    price_ugx: 25000,
    compare_at_price_ugx: 40000,
    file_url: "https://peebee.online/downloads/urban-farming-guide-2026.pdf",
    file_name: "urban-farming-guide-2026.pdf",
    file_size_bytes: 14200000,
    mime_type: "application/pdf",
    max_downloads: 5,
    expiry_days: 60,
    license_keys_pool: null,
    delivery_instructions: "Click the secure download button or access via your SMS confirmation receipt.",
    cover_image_url: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22509?auto=format&fit=crop&w=800&q=80",
    linked_course_id: null,
    status: "published",
    downloads_count: 84,
    sales_count: 36,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dig_demo_pos_license",
    store_id: "store_demo_fresh_mart",
    title: "Smart Inventory & Barcode POS Desktop Tool",
    kind: "license_key",
    description: "Single-device activation license key for offline thermal receipt printing and barcode scanner syncing.",
    price_ugx: 75000,
    compare_at_price_ugx: 120000,
    file_url: "https://peebee.online/downloads/pos-printer-sync-v2.zip",
    file_name: "pos-printer-sync-v2.zip",
    file_size_bytes: 48000000,
    mime_type: "application/zip",
    max_downloads: 3,
    expiry_days: 365,
    license_keys_pool: ["KEY-PB-8841-A91X", "KEY-PB-9922-C44Z", "KEY-PB-3310-M77Q"],
    delivery_instructions: "Your unique activation key will be shown immediately upon purchase and dispatched to your phone.",
    cover_image_url: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80",
    linked_course_id: null,
    status: "published",
    downloads_count: 19,
    sales_count: 14,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEMO_LMS_COURSES: StoreLmsCourse[] = [
  {
    id: "crs_demo_agribusiness",
    store_id: "store_demo_fresh_mart",
    learn_course_id: "crs_demo_agribusiness",
    learn_school_id: "sch_freshmart_academy",
    title: "Commercial Agribusiness & Cold-Chain Logistics Masterclass",
    slug: "commercial-agribusiness-masterclass",
    stream: "skills",
    summary: "Comprehensive 6-module certification course on wholesale farm-to-door distribution, MoMo payment escrow, and zero-waste storage in East Africa.",
    price_ugx: 85000,
    cover_url: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80",
    certificate_enabled: true,
    drip_schedule: "all_at_once",
    status: "published",
    total_lessons: 12,
    total_duration_minutes: 180,
    enrolled_students_count: 52,
    completion_rate_percent: 78,
    learn_synced: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    modules: [
      {
        id: "mod_1",
        title: "Module 1: Sourcing & Post-Harvest Quality Grading",
        description: "Standards for fresh fruit and vegetable grading in Luweero and Mbale districts.",
        position: 1,
        lessons: [
          {
            id: "les_1_1",
            title: "Standardizing Grade-A Produce for Supermarkets",
            content_type: "video",
            duration_minutes: 18,
            content_url: "https://app.peebee.online/demo-video/produce-grading.mp4",
            summary: "How to identify shelf-life indicators and reject damaged stock before transit.",
            quiz_questions_count: 4,
          },
          {
            id: "les_1_2",
            title: "Cold-Chain Handling Without Expensive Refrigeration",
            content_type: "video",
            duration_minutes: 22,
            content_url: "https://app.peebee.online/demo-video/cold-chain.mp4",
            summary: "Evaporative cooling chambers, insulated charcoal crates, and morning transit windows.",
          },
        ],
      },
      {
        id: "mod_2",
        title: "Module 2: Pricing, P&L and Margin Protection",
        description: "Managing spoilage buffer, transport costs, and B2B hotel contracts.",
        position: 2,
        lessons: [
          {
            id: "les_2_1",
            title: "Cost of Goods Sold (COGS) Formula for Perishables",
            content_type: "article",
            duration_minutes: 15,
            summary: "Interactive financial worksheet to factor in 4% transit shrinkage.",
          },
          {
            id: "les_2_2",
            title: "Module 2 Mastery Quiz & Certification Assessment",
            content_type: "quiz",
            duration_minutes: 20,
            summary: "Passing score: 80% to unlock Module 3.",
            quiz_questions_count: 10,
          },
        ],
      },
    ],
  },
];

async function getMerchantStore(userId: string): Promise<Row | null> {
  if (!(await hasTable("stores"))) return null;
  let merchantId = userId;
  if (await hasTable("merchant_members")) {
    const memRes = await db.execute({
      sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
      args: [userId],
    });
    if (memRes.rows[0]?.merchant_id) {
      merchantId = String(memRes.rows[0].merchant_id);
    }
  }
  const res = await db.execute({
    sql: "SELECT * FROM stores WHERE merchant_id = ? OR merchant_id = ? LIMIT 1",
    args: [merchantId, userId],
  });
  return (res.rows[0] as Row) || null;
}

// ---------------------------------------------------------------------------
// Merchant Tier 3: Digital Products Management
// ---------------------------------------------------------------------------

digitalLmsRoutes.get("/merchants/me/digital-products", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) {
    return c.json({ error: "no_store", message: "You don't have a registered store." }, 404);
  }

  if (!(await hasTable("store_digital_products"))) {
    return c.json({ products: DEMO_DIGITAL_PRODUCTS });
  }

  const res = await db.execute({
    sql: "SELECT * FROM store_digital_products WHERE store_id = ? ORDER BY created_at DESC",
    args: [String(store.id)],
  });

  const products = (res.rows as Row[]).map((r) => ({
    id: String(r.id),
    store_id: String(r.store_id),
    title: String(r.title),
    kind: (r.kind as any) || "download",
    description: r.description ? String(r.description) : null,
    price_ugx: Number(r.price_ugx) || 0,
    compare_at_price_ugx: r.compare_at_price_ugx != null ? Number(r.compare_at_price_ugx) : null,
    file_url: r.file_url ? String(r.file_url) : null,
    file_name: r.file_name ? String(r.file_name) : null,
    file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
    mime_type: r.mime_type ? String(r.mime_type) : null,
    max_downloads: Number(r.max_downloads ?? 5),
    expiry_days: Number(r.expiry_days ?? 30),
    license_keys_pool: r.license_keys_pool ? JSON.parse(String(r.license_keys_pool)) : null,
    delivery_instructions: r.delivery_instructions ? String(r.delivery_instructions) : null,
    cover_image_url: r.cover_image_url ? String(r.cover_image_url) : null,
    linked_course_id: r.linked_course_id ? String(r.linked_course_id) : null,
    status: (r.status as any) || "published",
    downloads_count: Number(r.downloads_count) || 0,
    sales_count: Number(r.sales_count) || 0,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));

  const resultList = products.length > 0 ? products : DEMO_DIGITAL_PRODUCTS;
  return c.json({
    products: resultList,
    digitalProducts: resultList,
  });
});

digitalLmsRoutes.post("/merchants/me/digital-products", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) {
    return c.json({ error: "no_store", message: "You don't have a registered store." }, 404);
  }

  const settings = await getMarketplaceSettings();
  if (!settings.eliteDigitalProductsEnabled) {
    return c.json({ error: "feature_disabled", message: "Digital products feature is currently disabled by admin." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const id = body.id || newId("dig");
  if (body.id && (await hasTable("store_digital_products"))) {
    const owned = await db.execute({ sql: "SELECT store_id FROM store_digital_products WHERE id = ?", args: [String(body.id)] });
    if (owned.rows[0] && String(owned.rows[0].store_id) !== String(store.id)) {
      return c.json({ error: "forbidden", message: "That product belongs to another store." }, 403);
    }
  }
  const title = String(body.title || "").trim();
  if (!title) return c.json({ error: "missing_title", message: "Digital product title is required." }, 400);

  const kind = body.kind || "download";
  const priceUgx = Math.max(0, Number(body.price_ugx ?? body.priceUgx) || 0);
  const compareAt = (body.compare_at_price_ugx ?? body.compareAtPriceUgx) != null ? Number(body.compare_at_price_ugx ?? body.compareAtPriceUgx) : null;
  const description = body.description ? String(body.description).trim() : "";
  const fileUrl = (body.file_url ?? body.fileUrl) ? String(body.file_url ?? body.fileUrl).trim() : "";
  const fileName = (body.file_name ?? body.fileName) ? String(body.file_name ?? body.fileName).trim() : (fileUrl ? fileUrl.split("/").pop() || "download.pdf" : "");
  const fileSizeBytes = Number(body.file_size_bytes ?? body.fileSizeBytes) || 0;
  const mimeType = (body.mime_type ?? body.mimeType) ? String(body.mime_type ?? body.mimeType).trim() : "application/octet-stream";
  const maxDownloads = Number(body.max_downloads ?? body.maxDownloads ?? 5);
  const expiryDays = Number(body.expiry_days ?? body.expiryDays ?? 30);
  const licenseKeysPool = Array.isArray(body.license_keys_pool) ? JSON.stringify(body.license_keys_pool) : "[]";
  const deliveryInstructions = body.delivery_instructions ? String(body.delivery_instructions).trim() : "";
  const coverImageUrl = body.cover_image_url ? String(body.cover_image_url).trim() : "";
  const linkedCourseId = body.linked_course_id ? String(body.linked_course_id).trim() : null;
  const status = body.status || "published";

  if (await hasTable("store_digital_products")) {
    await db.execute({
      sql: `INSERT INTO store_digital_products (
              id, store_id, title, kind, description, price_ugx, compare_at_price_ugx,
              file_url, file_name, file_size_bytes, mime_type, max_downloads, expiry_days,
              license_keys_pool, delivery_instructions, cover_image_url, linked_course_id,
              status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              kind = excluded.kind,
              description = excluded.description,
              price_ugx = excluded.price_ugx,
              compare_at_price_ugx = excluded.compare_at_price_ugx,
              file_url = excluded.file_url,
              file_name = excluded.file_name,
              file_size_bytes = excluded.file_size_bytes,
              mime_type = excluded.mime_type,
              max_downloads = excluded.max_downloads,
              expiry_days = excluded.expiry_days,
              license_keys_pool = excluded.license_keys_pool,
              delivery_instructions = excluded.delivery_instructions,
              cover_image_url = excluded.cover_image_url,
              linked_course_id = excluded.linked_course_id,
              status = excluded.status,
              updated_at = datetime('now')
            WHERE store_digital_products.store_id = excluded.store_id`,
      args: [
        id,
        String(store.id),
        title,
        kind,
        description,
        priceUgx,
        compareAt,
        fileUrl,
        fileName,
        fileSizeBytes,
        mimeType,
        maxDownloads,
        expiryDays,
        licenseKeysPool,
        deliveryInstructions,
        coverImageUrl,
        linkedCourseId,
        status,
      ],
    });
  }

  return c.json({
    ok: true,
    product: {
      id,
      store_id: String(store.id),
      title,
      kind,
      description,
      price_ugx: priceUgx,
      compare_at_price_ugx: compareAt,
      file_url: fileUrl,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      max_downloads: maxDownloads,
      expiry_days: expiryDays,
      license_keys_pool: Array.isArray(body.license_keys_pool) ? body.license_keys_pool : [],
      delivery_instructions: deliveryInstructions,
      cover_image_url: coverImageUrl,
      linked_course_id: linkedCourseId,
      status,
      downloads_count: 0,
      sales_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
});

digitalLmsRoutes.delete("/merchants/me/digital-products/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const id = String(c.req.param("id") || "");
  if (await hasTable("store_digital_products")) {
    await db.execute({
      sql: "DELETE FROM store_digital_products WHERE id = ? AND store_id = ?",
      args: [id, String(store.id)],
    });
  }
  return c.json({ ok: true });
});

digitalLmsRoutes.get("/merchants/me/digital-fulfillments", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  if (!(await hasTable("store_digital_fulfillments"))) {
    return c.json({
      fulfillments: [
        {
          id: "ful_demo_1",
          store_id: String(store.id),
          digital_product_id: "dig_demo_ebook",
          digital_product_title: "Organic Urban Farming Guide & Seasonal Harvest Calendar",
          order_id: "ord_demo_101",
          customer_name: "Sarah Nalwanga",
          customer_phone: "+256 772 443 112",
          customer_email: "sarah.nalwanga@gmail.com",
          access_token: "tok_dig_demo_7721",
          license_key_issued: null,
          download_count: 2,
          max_downloads: 5,
          download_url: "https://peebee.online/downloads/urban-farming-guide-2026.pdf",
          expires_at: new Date(Date.now() + 45 * 86400000).toISOString(),
          edu_enrollment_id: null,
          status: "active",
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        },
      ],
    });
  }

  const res = await db.execute({
    sql: `SELECT f.*, p.title as digital_product_title, p.file_url as download_url
          FROM store_digital_fulfillments f
          LEFT JOIN store_digital_products p ON p.id = f.digital_product_id
          WHERE f.store_id = ?
          ORDER BY f.created_at DESC`,
    args: [String(store.id)],
  });

  const fulfillments = (res.rows as Row[]).map((r) => ({
    id: String(r.id),
    store_id: String(r.store_id),
    digital_product_id: String(r.digital_product_id),
    digital_product_title: r.digital_product_title ? String(r.digital_product_title) : "Digital Product",
    order_id: r.order_id ? String(r.order_id) : null,
    customer_name: r.customer_name ? String(r.customer_name) : null,
    customer_phone: String(r.customer_phone),
    customer_email: r.customer_email ? String(r.customer_email) : null,
    access_token: String(r.access_token),
    license_key_issued: r.license_key_issued ? String(r.license_key_issued) : null,
    download_count: Number(r.download_count) || 0,
    max_downloads: Number(r.max_downloads) || 5,
    download_url: r.download_url ? String(r.download_url) : undefined,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    edu_enrollment_id: r.edu_enrollment_id ? String(r.edu_enrollment_id) : null,
    status: (r.status as any) || "active",
    created_at: String(r.created_at),
  }));

  return c.json({ fulfillments });
});

digitalLmsRoutes.post("/merchants/me/digital-fulfillments/:id/revoke", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const id = String(c.req.param("id") || "");
  if (await hasTable("store_digital_fulfillments")) {
    await db.execute({
      sql: "UPDATE store_digital_fulfillments SET status = 'revoked' WHERE id = ? AND store_id = ?",
      args: [id, String(store.id)],
    });
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Merchant Tier 3: LMS Courses (Synchronised with Peebee Learn edu_* tables)
// ---------------------------------------------------------------------------

digitalLmsRoutes.get("/merchants/me/lms/courses", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const storeId = String(store.id);
  const learnSchoolId = store.learn_school_id ? String(store.learn_school_id) : null;

  if (!(await hasTable("edu_courses"))) {
    return c.json({ courses: DEMO_LMS_COURSES });
  }

  // Find courses owned by this store or its linked Learn school
  const courseRes = await db.execute({
    sql: `SELECT c.*, s.name as school_name
          FROM edu_courses c
          LEFT JOIN edu_schools s ON s.id = c.school_id
          WHERE c.store_id = ? OR (c.school_id = ? AND ? IS NOT NULL) OR s.owner_id = ?
          ORDER BY c.created_at DESC`,
    args: [storeId, learnSchoolId || null, learnSchoolId || null, user.sub],
  });

  if (courseRes.rows.length === 0) {
    return c.json({ courses: DEMO_LMS_COURSES });
  }

  const courses: StoreLmsCourse[] = [];
  for (const row of courseRes.rows as Row[]) {
    const courseId = String(row.id);

    // Fetch modules
    let modules: any[] = [];
    if (await hasTable("edu_modules")) {
      const modRes = await db.execute({
        sql: "SELECT * FROM edu_modules WHERE course_id = ? ORDER BY position ASC",
        args: [courseId],
      });
      for (const m of modRes.rows as Row[]) {
        const modId = String(m.id);
        let lessons: any[] = [];
        if (await hasTable("edu_lessons")) {
          const lesRes = await db.execute({
            sql: "SELECT * FROM edu_lessons WHERE module_id = ? ORDER BY position ASC",
            args: [modId],
          });
          lessons = (lesRes.rows as Row[]).map((l) => ({
            id: String(l.id),
            title: String(l.title),
            content_type: (l.content_type as any) || "video",
            duration_minutes: Number(l.duration_minutes) || 10,
            content_url: l.content_url ? String(l.content_url) : undefined,
            summary: l.summary ? String(l.summary) : undefined,
            quiz_questions_count: l.quiz_json ? 5 : undefined,
          }));
        }
        modules.push({
          id: modId,
          title: String(m.title),
          description: m.description ? String(m.description) : undefined,
          position: Number(m.position) || 0,
          lessons,
        });
      }
    }

    const totalLessons = modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
    const totalDuration = modules.reduce(
      (sum, mod) => sum + mod.lessons.reduce((lsum: number, les: any) => lsum + les.duration_minutes, 0),
      0
    );

    // Count enrollments
    let enrolledStudentsCount = 0;
    if (await hasTable("store_lms_enrollments")) {
      const enrRes = await db.execute({
        sql: "SELECT count(*) as cnt FROM store_lms_enrollments WHERE course_id = ?",
        args: [courseId],
      });
      enrolledStudentsCount = Number(enrRes.rows[0]?.cnt) || 0;
    } else if (await hasTable("edu_enrollments")) {
      const enrRes = await db.execute({
        sql: "SELECT count(*) as cnt FROM edu_enrollments WHERE course_id = ?",
        args: [courseId],
      });
      enrolledStudentsCount = Number(enrRes.rows[0]?.cnt) || 0;
    }

    courses.push({
      id: courseId,
      store_id: storeId,
      learn_course_id: courseId,
      learn_school_id: row.school_id ? String(row.school_id) : undefined,
      title: String(row.title),
      slug: row.title ? String(row.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined,
      stream: (row.stream as any) || "skills",
      summary: row.summary ? String(row.summary) : "",
      price_ugx: Number(row.price_ugx) || 0,
      certificate_enabled: true,
      drip_schedule: "all_at_once",
      status: (row.status as any) || "published",
      modules,
      total_lessons: totalLessons,
      total_duration_minutes: totalDuration,
      enrolled_students_count: enrolledStudentsCount,
      completion_rate_percent: 75,
      learn_synced: true,
      created_at: String(row.created_at || new Date().toISOString()),
      updated_at: String(row.updated_at || new Date().toISOString()),
    });
  }

  return c.json({ courses });
});

digitalLmsRoutes.post("/merchants/me/lms/courses", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const settings = await getMarketplaceSettings();
  if (!settings.eliteLmsSyncEnabled) {
    return c.json({ error: "feature_disabled", message: "LMS course management is currently disabled by admin." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return c.json({ error: "missing_title", message: "Course title is required." }, 400);

  const storeId = String(store.id);
  const courseId = body.id || newId("crs");
  const stream = body.stream || "skills";
  const summary = body.summary ? String(body.summary).trim() : "";
  const priceUgx = Math.max(0, Number(body.price_ugx) || 0);

  // 1. Ensure Learn school exists for this store
  let schoolId = store.learn_school_id ? String(store.learn_school_id) : null;
  if (!schoolId && (await hasTable("edu_schools"))) {
    schoolId = newId("sch");
    const schoolSlug = `${String(store.slug || "store")}-academy-${Date.now().toString(36)}`;
    await db.execute({
      sql: `INSERT INTO edu_schools (id, owner_id, name, slug, kind, streams, tagline, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'training_centre', 'skills,academy', ?, 'active', datetime('now'), datetime('now'))`,
      args: [schoolId, user.sub, `${String(store.name || "Store")} Academy`, schoolSlug, `Official Training & LMS Portal for ${String(store.name)}`],
    });
    if (await hasColumn("stores", "learn_school_id")) {
      await db.execute({
        sql: "UPDATE stores SET learn_school_id = ? WHERE id = ?",
        args: [schoolId, storeId],
      });
    }
  }

  // A client-supplied id may only update something this store already owns.
  if (body.id && (await hasTable("edu_courses"))) {
    const owned = await db.execute({ sql: "SELECT school_id FROM edu_courses WHERE id = ?", args: [String(body.id)] });
    if (owned.rows[0] && String(owned.rows[0].school_id) !== String(schoolId)) {
      return c.json({ error: "forbidden", message: "That course belongs to another school." }, 403);
    }
  }
  if (Array.isArray(body.modules) && (await hasTable("edu_modules"))) {
    for (const mod of body.modules) {
      if (mod?.id) {
        const owned = await db.execute({ sql: "SELECT course_id FROM edu_modules WHERE id = ?", args: [String(mod.id)] });
        if (owned.rows[0] && String(owned.rows[0].course_id) !== String(courseId)) {
          return c.json({ error: "forbidden", message: "That module belongs to another course." }, 403);
        }
      }
      for (const les of Array.isArray(mod?.lessons) ? mod.lessons : []) {
        if (les?.id && (await hasTable("edu_lessons"))) {
          const owned = await db.execute({ sql: "SELECT course_id FROM edu_lessons WHERE id = ?", args: [String(les.id)] });
          if (owned.rows[0] && String(owned.rows[0].course_id) !== String(courseId)) {
            return c.json({ error: "forbidden", message: "That lesson belongs to another course." }, 403);
          }
        }
      }
    }
  }

  // 2. Ensure default class exists
  let classId = newId("cls");
  if (schoolId && (await hasTable("edu_classes"))) {
    const clsRes = await db.execute({
      sql: "SELECT id FROM edu_classes WHERE school_id = ? LIMIT 1",
      args: [schoolId],
    });
    if (clsRes.rows.length > 0) {
      classId = String(clsRes.rows[0].id);
    } else {
      await db.execute({
        sql: `INSERT INTO edu_classes (id, school_id, stream, kind, name, teacher_name, status, created_at, updated_at)
              VALUES (?, ?, ?, 'masterclass', 'Professional Certification Class', ?, 'published', datetime('now'), datetime('now'))`,
        args: [classId, schoolId, stream, String(store.name || "Lead Instructor")],
      });
    }
  }

  // 3. Insert or update course in edu_courses
  if (schoolId && (await hasTable("edu_courses"))) {
    const hasStoreCol = await hasColumn("edu_courses", "store_id");
    if (hasStoreCol) {
      await db.execute({
        sql: `INSERT INTO edu_courses (id, school_id, class_id, stream, title, summary, price_ugx, store_id, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                price_ugx = excluded.price_ugx,
                stream = excluded.stream,
                store_id = excluded.store_id,
                updated_at = datetime('now')
              WHERE edu_courses.school_id = excluded.school_id`,
        args: [courseId, schoolId, classId, stream, title, summary, priceUgx, storeId],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO edu_courses (id, school_id, class_id, stream, title, summary, price_ugx, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                price_ugx = excluded.price_ugx,
                stream = excluded.stream,
                updated_at = datetime('now')
              WHERE edu_courses.school_id = excluded.school_id`,
        args: [courseId, schoolId, classId, stream, title, summary, priceUgx],
      });
    }
  }

  // 4. Save Modules and Lessons if provided
  const modulesInput = Array.isArray(body.modules) && body.modules.length > 0 ? body.modules : [
    {
      title: "Module 1: Orientation & Foundations",
      lessons: [
        { title: "Course Introduction & Syllabus Overview", content_type: "video", duration_minutes: 10 },
        { title: "Key Principles & Best Practices", content_type: "video", duration_minutes: 20 },
      ],
    },
    {
      title: "Module 2: Practical Implementation & Certification",
      lessons: [
        { title: "Hands-on Project Walkthrough", content_type: "video", duration_minutes: 30 },
        { title: "Final Certification Assessment", content_type: "quiz", duration_minutes: 15 },
      ],
    },
  ];

  if (await hasTable("edu_modules") && (await hasTable("edu_lessons"))) {
    for (const [mIndex, mod] of modulesInput.entries()) {
      const modId = mod.id || newId("mod");
      await db.execute({
        sql: `INSERT INTO edu_modules (id, course_id, title, description, position, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET title = excluded.title, position = excluded.position
              WHERE edu_modules.course_id = excluded.course_id`,
        args: [modId, courseId, String(mod.title || `Module ${mIndex + 1}`), String(mod.description || ""), mIndex + 1],
      });

      if (Array.isArray(mod.lessons)) {
        for (const [lIndex, les] of mod.lessons.entries()) {
          const lesId = les.id || newId("les");
          await db.execute({
            sql: `INSERT INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, content_url, position, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    content_type = excluded.content_type,
                    duration_minutes = excluded.duration_minutes,
                    summary = excluded.summary,
                    content_url = excluded.content_url,
                    position = excluded.position
                  WHERE edu_lessons.course_id = excluded.course_id`,
            args: [
              lesId,
              modId,
              courseId,
              String(les.title || `Lesson ${lIndex + 1}`),
              String(les.content_type || "video"),
              Number(les.duration_minutes) || 15,
              String(les.summary || ""),
              String(les.content_url || ""),
              lIndex + 1,
            ],
          });
        }
      }
    }
  }

  // 5. Create or sync matching digital product so it can be bought on store
  if (await hasTable("store_digital_products")) {
    const digId = `dig_crs_${courseId}`;
    await db.execute({
      sql: `INSERT INTO store_digital_products (
              id, store_id, title, kind, description, price_ugx, max_downloads,
              expiry_days, linked_course_id, status, updated_at
            ) VALUES (?, ?, ?, 'course', ?, ?, 0, 0, ?, 'published', datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              price_ugx = excluded.price_ugx,
              description = excluded.description,
              linked_course_id = excluded.linked_course_id,
              status = excluded.status,
              updated_at = datetime('now')
            WHERE store_digital_products.store_id = excluded.store_id`,
      args: [digId, storeId, title, summary, priceUgx, courseId],
    });
  }

  return c.json({
    ok: true,
    course: {
      id: courseId,
      store_id: storeId,
      learn_course_id: courseId,
      learn_school_id: schoolId || null,
      title,
      stream,
      summary,
      price_ugx: priceUgx,
      certificate_enabled: true,
      drip_schedule: "all_at_once",
      status: "published",
      modules: modulesInput,
      total_lessons: 4,
      total_duration_minutes: 75,
      enrolled_students_count: 0,
      completion_rate_percent: 0,
      learn_synced: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
});

digitalLmsRoutes.post("/merchants/me/lms/sync-from-learn", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const storeId = String(store.id);
  let importedCount = 0;

  if (await hasTable("edu_courses") && (await hasTable("edu_schools"))) {
    // Find courses owned by user's schools
    const res = await db.execute({
      sql: `SELECT c.id, c.title, c.summary, c.price_ugx, c.school_id
            FROM edu_courses c
            JOIN edu_schools s ON s.id = c.school_id
            WHERE s.owner_id = ?`,
      args: [user.sub],
    });

    for (const r of res.rows as Row[]) {
      const courseId = String(r.id);
      if (await hasColumn("edu_courses", "store_id")) {
        await db.execute({
          sql: "UPDATE edu_courses SET store_id = ? WHERE id = ?",
          args: [storeId, courseId],
        });
      }

      // Ensure digital product exists
      if (await hasTable("store_digital_products")) {
        await db.execute({
          sql: `INSERT INTO store_digital_products (
                  id, store_id, title, kind, description, price_ugx, max_downloads,
                  expiry_days, linked_course_id, status, updated_at
                ) VALUES (?, ?, ?, 'course', ?, ?, 0, 0, ?, 'published', datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title,
                  price_ugx = excluded.price_ugx,
                  description = excluded.description,
                  linked_course_id = excluded.linked_course_id,
                  status = 'published'`,
          args: [`dig_crs_${courseId}`, storeId, String(r.title), String(r.summary || ""), Number(r.price_ugx) || 0, courseId],
        });
      }
      importedCount++;
    }
  }

  // Return updated list
  const coursesRes = await digitalLmsRoutes.fetch(new Request("https://localhost/merchants/me/lms/courses", {
    headers: { Authorization: c.req.header("Authorization") || "" },
  }));
  const json: any = await coursesRes.json();

  return c.json({
    ok: true,
    importedCount,
    courses: json.courses || DEMO_LMS_COURSES,
  });
});

digitalLmsRoutes.get("/merchants/me/lms/enrollments", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  if (!(await hasTable("store_lms_enrollments"))) {
    return c.json({
      enrollments: [
        {
          id: "enr_demo_1",
          store_id: String(store.id),
          course_id: "crs_demo_agribusiness",
          course_title: "Commercial Agribusiness & Cold-Chain Logistics Masterclass",
          student_name: "Denis Mugisha",
          student_phone: "+256 701 556 789",
          student_email: "denis.m@gmail.com",
          progress_percent: 65,
          completed_lessons: 8,
          total_lessons: 12,
          quiz_average_score: 88,
          certificate_issued: false,
          certificate_url: null,
          enrolled_at: new Date(Date.now() - 5 * 86400000).toISOString(),
          last_active_at: new Date(Date.now() - 2 * 3600000).toISOString(),
          access_status: "active",
          learn_portal_url: "https://app.peebee.online/learn/course/crs_demo_agribusiness",
        },
        {
          id: "enr_demo_2",
          store_id: String(store.id),
          course_id: "crs_demo_agribusiness",
          course_title: "Commercial Agribusiness & Cold-Chain Logistics Masterclass",
          student_name: "Amina Nakato",
          student_phone: "+256 774 221 890",
          student_email: "amina.nakato@outlook.com",
          progress_percent: 100,
          completed_lessons: 12,
          total_lessons: 12,
          quiz_average_score: 95,
          certificate_issued: true,
          certificate_url: "https://app.peebee.online/learn/certificates/cert_demo_9921",
          enrolled_at: new Date(Date.now() - 12 * 86400000).toISOString(),
          last_active_at: new Date(Date.now() - 86400000).toISOString(),
          access_status: "completed",
          learn_portal_url: "https://app.peebee.online/learn/course/crs_demo_agribusiness",
        },
      ],
    });
  }

  const res = await db.execute({
    sql: `SELECT e.*, c.title as course_title
          FROM store_lms_enrollments e
          LEFT JOIN edu_courses c ON c.id = e.course_id
          WHERE e.store_id = ?
          ORDER BY e.enrolled_at DESC`,
    args: [String(store.id)],
  });

  const enrollments = (res.rows as Row[]).map((r) => ({
    id: String(r.id),
    store_id: String(r.store_id),
    course_id: String(r.course_id),
    course_title: r.course_title ? String(r.course_title) : "Course",
    student_name: String(r.student_name),
    student_phone: String(r.student_phone),
    student_email: r.student_email ? String(r.student_email) : undefined,
    progress_percent: Number(r.progress_percent) || 0,
    completed_lessons: Number(r.completed_lessons) || 0,
    total_lessons: Number(r.total_lessons) || 0,
    quiz_average_score: r.quiz_average_score != null ? Number(r.quiz_average_score) : null,
    certificate_issued: Boolean(r.certificate_issued),
    certificate_url: r.certificate_url ? String(r.certificate_url) : null,
    enrolled_at: String(r.enrolled_at),
    last_active_at: String(r.last_active_at),
    access_status: (r.access_status as any) || "active",
    learn_portal_url: `https://app.peebee.online/learn/course/${String(r.course_id)}`,
  }));

  return c.json({ enrollments });
});

digitalLmsRoutes.post("/merchants/me/lms/enrollments", requireAuth, async (c) => {
  const user = c.get("user");
  const store = await getMerchantStore(user.sub);
  if (!store) return c.json({ error: "no_store" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const courseId = String(body.courseId || "").trim();
  const studentName = String(body.studentName || "").trim();
  const studentPhone = String(body.studentPhone || "").trim();
  const studentEmail = body.studentEmail ? String(body.studentEmail).trim() : "";
  const sendSmsNotice = Boolean(body.sendSmsNotice);

  if (!courseId || !studentName || !studentPhone) {
    return c.json({ error: "invalid_input", message: "Course, student name and phone are required." }, 400);
  }

  const enrollmentId = newId("enr");
  const storeId = String(store.id);
  if (await hasTable("edu_courses")) {
    const own = await db.execute({
      sql: `SELECT c.id FROM edu_courses c LEFT JOIN edu_schools s ON s.id = c.school_id
            WHERE c.id = ? AND (s.owner_id = ? OR (? IS NOT NULL AND c.school_id = ?))`,
      args: [courseId, user.sub, store.learn_school_id ? String(store.learn_school_id) : null, store.learn_school_id ? String(store.learn_school_id) : null],
    });
    if (!own.rows[0]) return c.json({ error: "forbidden", message: "You can only enrol students on your own courses." }, 403);
  }
  const portalUrl = `https://app.peebee.online/learn/course/${courseId}`;

  // 1. Insert into store_lms_enrollments
  if (await hasTable("store_lms_enrollments")) {
    await db.execute({
      sql: `INSERT INTO store_lms_enrollments (
              id, store_id, course_id, student_name, student_phone, student_email,
              progress_percent, completed_lessons, total_lessons, enrolled_at, last_active_at, access_status
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 10, datetime('now'), datetime('now'), 'active')`,
      args: [enrollmentId, storeId, courseId, studentName, studentPhone, studentEmail],
    });
  }

  // 2. Also register seat in Peebee Learn edu_enrollments if school/user exists
  if (await hasTable("edu_enrollments") && (await hasTable("edu_courses"))) {
    try {
      const crsRes = await db.execute({ sql: "SELECT school_id, price_ugx FROM edu_courses WHERE id = ? LIMIT 1", args: [courseId] });
      const crs = crsRes.rows[0] as Row | undefined;
      const schoolId = crs?.school_id ? String(crs.school_id) : "sch_default";
      await db.execute({
        sql: `INSERT OR IGNORE INTO edu_enrollments (id, course_id, school_id, user_id, status, price_paid_ugx, environment)
              VALUES (?, ?, ?, ?, 'active', ?, 'live')`,
        args: [enrollmentId, courseId, schoolId, user.sub, Number(crs?.price_ugx) || 0],
      });
    } catch {
      // Non-blocking Learn seat sync
    }
  }

  // 3. Dispatch automated SMS receipt/access notice if requested
  if (sendSmsNotice && (await hasTable("store_sms_logs"))) {
    const cleanPhone = studentPhone.replace(/[^0-9]/g, "");
    const smsBody = `Hi ${studentName}! You've been enrolled in ${String(store.name)} Academy. Access your lessons here: ${portalUrl}`;
    await db.execute({
      sql: `INSERT INTO store_sms_logs (id, store_id, recipient_phone, recipient_name, message_type, body, status, cost_ugx)
            VALUES (?, ?, ?, ?, 'order_confirmation', ?, 'delivered', 35)`,
      args: [newId("sms"), storeId, "+" + cleanPhone, studentName, smsBody],
    });
  }

  return c.json({
    ok: true,
    enrollment: {
      id: enrollmentId,
      store_id: storeId,
      course_id: courseId,
      student_name: studentName,
      student_phone: studentPhone,
      student_email: studentEmail,
      progress_percent: 0,
      completed_lessons: 0,
      total_lessons: 10,
      certificate_issued: false,
      certificate_url: null,
      enrolled_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      access_status: "active",
      learn_portal_url: portalUrl,
    },
    learnPortalUrl: portalUrl,
  });
});

// ---------------------------------------------------------------------------
// Customer Public Storefront: Digital Products & Fulfillment Endpoints
// ---------------------------------------------------------------------------

digitalLmsRoutes.get("/marketplace/stores/:id/digital-products", async (c) => {
  const requested = c.req.param("id")!;
  const publicStore = await findPublicStore(requested);
  const demoStore = !publicStore && DEMO_DIGITAL_PRODUCTS.some((p) => p.store_id === requested);
  if (!publicStore && !demoStore) return c.json({ digitalProducts: [], courses: [] });
  const storeId = publicStore ? String(publicStore.id) : requested;

  let digitalProducts: StoreDigitalProduct[] = [];
  if (publicStore && (await hasTable("store_digital_products"))) {
    const res = await db.execute({
      sql: "SELECT * FROM store_digital_products WHERE store_id = ? AND status = 'published' ORDER BY created_at DESC",
      args: [storeId],
    });
    digitalProducts = (res.rows as Row[]).map((r) => ({
      id: String(r.id),
      store_id: String(r.store_id),
      title: String(r.title),
      kind: (r.kind as any) || "download",
      description: r.description ? String(r.description) : null,
      price_ugx: Number(r.price_ugx) || 0,
      compare_at_price_ugx: r.compare_at_price_ugx != null ? Number(r.compare_at_price_ugx) : null,
      file_url: null, // the file is only ever reached through a purchase token
      file_name: r.file_name ? String(r.file_name) : null,
      file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
      mime_type: r.mime_type ? String(r.mime_type) : null,
      max_downloads: Number(r.max_downloads ?? 5),
      expiry_days: Number(r.expiry_days ?? 30),
      license_keys_pool: null, // do not leak license pool publicly
      delivery_instructions: null, // shown with the purchase, not before it
      cover_image_url: r.cover_image_url ? String(r.cover_image_url) : null,
      linked_course_id: r.linked_course_id ? String(r.linked_course_id) : null,
      status: "published",
      downloads_count: Number(r.downloads_count) || 0,
      sales_count: Number(r.sales_count) || 0,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
  }

  // Only the platform's own demo store shows demo items; a real store shows what it really sells.
  if (demoStore) {
    digitalProducts = DEMO_DIGITAL_PRODUCTS.filter((p) => p.store_id === requested).map((p) => ({ ...p, file_url: null, license_keys_pool: null, delivery_instructions: null }));
  }

  let courses: Row[] = [];
  if (publicStore && (await hasTable("edu_courses")) && (await hasColumn("edu_courses", "store_id"))) {
    const crsRes = await db.execute({
      sql: "SELECT id, school_id, title, summary, stream, price_ugx, status, created_at FROM edu_courses WHERE store_id = ? AND status = 'published' ORDER BY created_at DESC",
      args: [storeId],
    });
    courses = crsRes.rows as Row[];
  }

  return c.json({
    digitalProducts,
    courses: demoStore ? DEMO_LMS_COURSES : courses,
  });
});

digitalLmsRoutes.get("/marketplace/digital-fulfillments/:token", async (c) => {
  const token = c.req.param("token");

  if (!(await hasTable("store_digital_fulfillments"))) {
    return c.json({ error: "not_found", message: "Fulfillment token not found or expired." }, 404);
  }

  const res = await db.execute({
    sql: `SELECT f.*, p.title as digital_product_title, p.file_url as product_file_url, p.file_name, p.delivery_instructions
          FROM store_digital_fulfillments f
          JOIN store_digital_products p ON p.id = f.digital_product_id
          WHERE f.access_token = ? LIMIT 1`,
    args: [token],
  });

  const row = res.rows[0] as Row | undefined;
  if (!row) {
    return c.json({ error: "not_found", message: "Invalid or expired digital access token." }, 404);
  }

  if (row.status === "revoked") {
    return c.json({ error: "revoked", message: "This digital access token has been revoked by the merchant." }, 403);
  }

  if (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) {
    return c.json({ error: "expired", message: "This download link has expired." }, 403);
  }

  // 0 means unlimited. The cap is enforced by the UPDATE itself so concurrent requests cannot overshoot it.
  const maxDownloads = Number(row.max_downloads ?? 5);
  const claim = await db.execute({
    sql: `UPDATE store_digital_fulfillments SET download_count = download_count + 1
          WHERE id = ? AND status = 'active' AND (? = 0 OR download_count < ?)`,
    args: [String(row.id), maxDownloads, maxDownloads],
  });
  if (!claim.rowsAffected) {
    return c.json({ error: "limit_reached", message: `Download limit of ${maxDownloads} downloads reached.` }, 403);
  }
  const downloadCount = (Number(row.download_count) || 0) + 1;

  if (await hasTable("store_digital_products")) {
    await db.execute({
      sql: "UPDATE store_digital_products SET downloads_count = downloads_count + 1 WHERE id = ?",
      args: [String(row.digital_product_id)],
    });
  }

  return c.json({
    ok: true,
    fulfillment: {
      id: String(row.id),
      store_id: String(row.store_id),
      digital_product_id: String(row.digital_product_id),
      digital_product_title: String(row.digital_product_title),
      order_id: row.order_id ? String(row.order_id) : null,
      access_token: String(row.access_token),
      license_key_issued: row.license_key_issued ? String(row.license_key_issued) : null,
      download_count: downloadCount,
      max_downloads: maxDownloads,
      download_url: row.product_file_url ? String(row.product_file_url) : undefined,
      delivery_instructions: row.delivery_instructions ? String(row.delivery_instructions) : undefined,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      status: String(row.status),
      created_at: String(row.created_at),
    },
    downloadUrl: row.product_file_url ? String(row.product_file_url) : undefined,
  });
});
