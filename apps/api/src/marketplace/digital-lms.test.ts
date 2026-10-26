import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { signToken } from "../auth/jwt.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql,
    args: [] as unknown[],
    bind(...args: unknown[]) {
      this.args = args;
      return this;
    },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      const results = await client.batch(statements.map(({ sql, args }) => ({ sql, args: args as InArgs })), "write");
      return results.map((result) => ({ results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } }));
    },
  } as unknown as D1Database);
}

test("merchant tier 3: digital products CRUD, downloads, LMS curriculum builder, and Peebee Learn sync", async () => {
  process.env.JWT_SECRET = "marketplace-tests-only";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = existsSync(join(process.cwd(), "apps/api/src/db/migrations"))
    ? join(process.cwd(), "apps/api/src/db/migrations")
    : join(process.cwd(), "src/db/migrations");

  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) {
      await client.execute(sql);
    }
  }
  bindDatabase(client);

  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, status) VALUES ('usr_mch_lms', '+256701112233', 'Elite Academy Director', 'hash', 'customer', 'active')");
  await client.execute("INSERT INTO merchants (id, legal_name, display_name, business_kind, status, environment) VALUES ('m_lms_1', 'Elite Academy Ltd', 'Elite Academy', 'business', 'active', 'sandbox')");
  await client.execute("INSERT INTO merchant_members (merchant_id, user_id, role, status) VALUES ('m_lms_1', 'usr_mch_lms', 'owner', 'active')");

  const merchantJwt = await signToken({
    sub: "usr_mch_lms",
    role: "customer",
  });

  const req = (path: string, method = "GET", body?: object) =>
    app.request(`/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${merchantJwt}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  // 1. Launch Marketplace Store (Tier 2/3)
  const storeRes = await req("/merchants/me/store", "POST", {
    name: "Elite Academy & Presets",
    slug: "elite-academy",
    category: "stores",
    proTier: "pro_store",
  });
  assert.ok(storeRes.status === 200 || storeRes.status === 201);
  const storeData = (await storeRes.json()) as any;
  const storeId = storeData.store.id;
  const storeSlug = storeData.store.slug;

  // Upgrade store to Tier 3 (Elite)
  await client.execute({
    sql: "UPDATE stores SET elite_tier = 1 WHERE id = ?",
    args: [storeId],
  });

  // 2. Merchant creates a digital product (PDF eBook)
  const createDigRes = await req("/merchants/me/digital-products", "POST", {
    title: "Kampala Urban Agriculture Master Blueprint",
    kind: "download",
    description: "Complete 120-page comprehensive guide on hydroponics and organic micro-farming in Uganda.",
    priceUgx: 45000,
    compareAtPriceUgx: 65000,
    fileName: "kampala-hydroponics-guide-v2.pdf",
    fileUrl: "https://r2.peebee.online/digital/kampala-hydroponics-guide-v2.pdf",
    fileSizeBytes: 12500000,
    mimeType: "application/pdf",
    maxDownloads: 5,
    expiryDays: 30,
    deliveryInstructions: "Save to your device and verify page 12 for the regional supplier directory.",
  });

  assert.equal(createDigRes.status, 200);
  const createdDig = (await createDigRes.json()) as any;
  assert.equal(createdDig.product.title, "Kampala Urban Agriculture Master Blueprint");
  assert.equal(createdDig.product.price_ugx, 45000);
  assert.equal(createdDig.product.file_name, "kampala-hydroponics-guide-v2.pdf");

  // 3. Merchant fetches their digital products list
  const listDigRes = await req("/merchants/me/digital-products");
  assert.equal(listDigRes.status, 200);
  const listDigData = (await listDigRes.json()) as any;
  assert.equal(listDigData.digitalProducts.length, 1);
  assert.equal(listDigData.digitalProducts[0].id, createdDig.product.id);

  // 4. Create an LMS Masterclass course synced with Peebee Learn
  const createCourseRes = await req("/merchants/me/lms/courses", "POST", {
    title: "Commercial Poultry & Broiler Production Masterclass",
    summary: "End-to-end practical video masterclass on intensive commercial broiler farming and feed formulating.",
    priceUgx: 80000,
    category: "Agribusiness & Farming",
    level: "Intermediate",
    durationMinutes: 180,
    stream: "skills",
    modules: [
      {
        title: "Module 1: Brooding Architecture & Temperature Control",
        description: "Setting up charcoal brooders and bio-security footbaths in central Uganda.",
        position: 1,
        lessons: [
          {
            title: "Lesson 1: Brooder House Disinfection Protocol",
            kind: "video",
            durationSeconds: 900,
            contentUrl: "https://video.peebee.online/courses/brooding-disinfection.mp4",
            position: 1,
          },
          {
            title: "Lesson 2: Feed Mixing Formulas (Starter & Finisher)",
            kind: "article",
            durationSeconds: 600,
            position: 2,
          },
        ],
      },
    ],
  });

  assert.equal(createCourseRes.status, 200);
  const createdCourseData = (await createCourseRes.json()) as any;
  assert.ok(createdCourseData.course.id);
  assert.equal(createdCourseData.course.title, "Commercial Poultry & Broiler Production Masterclass");
  assert.equal(createdCourseData.course.modules.length, 1);
  assert.equal(createdCourseData.course.modules[0].lessons.length, 2);

  // 5. Verify 2-Way Sync: Course is stored in edu_courses AND in store_digital_products
  const dbCourseRes = await client.execute({
    sql: "SELECT * FROM edu_courses WHERE id = ?",
    args: [createdCourseData.course.id],
  });
  assert.equal(dbCourseRes.rows.length, 1);
  assert.equal(dbCourseRes.rows[0].title, "Commercial Poultry & Broiler Production Masterclass");

  const dbDigitalCourseRes = await client.execute({
    sql: "SELECT * FROM store_digital_products WHERE linked_course_id = ?",
    args: [createdCourseData.course.id],
  });
  assert.equal(dbDigitalCourseRes.rows.length, 1);
  assert.equal(dbDigitalCourseRes.rows[0].kind, "course");

  // 6. Manual Student Enrollment CRM with SMS dispatch
  const enrollRes = await req("/merchants/me/lms/enrollments", "POST", {
    courseId: createdCourseData.course.id,
    studentName: "Grace Nakato",
    studentPhone: "+256701234567",
    studentEmail: "nakato.grace@gmail.com",
    paymentStatus: "paid",
    pricePaidUgx: 80000,
    notes: "Walk-in cash payment at Kampala Agri Expo booth",
  });

  assert.equal(enrollRes.status, 200);
  const enrollData = (await enrollRes.json()) as any;
  assert.ok(enrollData.enrollment.id);
  assert.equal(enrollData.enrollment.student_name, "Grace Nakato");
  assert.ok(enrollData.learnPortalUrl.includes("/learn/course/"));

  // 7. Merchant queries student progress CRM ledger
  const enrollListRes = await req("/merchants/me/lms/enrollments");
  assert.equal(enrollListRes.status, 200);
  const enrollListData = (await enrollListRes.json()) as any;
  assert.equal(enrollListData.enrollments.length, 1);
  assert.equal(enrollListData.enrollments[0].student_name, "Grace Nakato");

  // 8. Public storefront retrieval
  const pubStoreRes = await app.request(`/v1/marketplace/stores/${storeSlug}`);
  assert.equal(pubStoreRes.status, 200);
  const pubStoreData = (await pubStoreRes.json()) as any;
  assert.equal(pubStoreData.digitalProducts.length, 2); // 1 download + 1 course digital product
  assert.equal(pubStoreData.courses.length, 1);
  assert.equal(pubStoreData.courses[0].title, "Commercial Poultry & Broiler Production Masterclass");
});
