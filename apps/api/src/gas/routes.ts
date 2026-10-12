import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";
import { getGasSettings } from "../lib/settings.js";
import { verifyToken } from "../auth/jwt.js";

export const gasRoutes = new Hono();

// Fallback products and outlets metadata
const FALLBACK_PRODUCTS = [
  { id: "prod_petrol", name: "Unleaded Petrol", category: "fuel", unit: "L", defaultPrice: 5450 },
  { id: "prod_diesel", name: "Ultra Low Sulphur Diesel", category: "fuel", unit: "L", defaultPrice: 5150 },
  { id: "prod_vpower", name: "Shell V-Power / Excellium", category: "fuel", unit: "L", defaultPrice: 5850 },
  { id: "prod_oil_2t", name: "2T Two-Stroke Boda Oil", category: "lubricant", unit: "L", defaultPrice: 12000 },
  { id: "prod_oil_4t", name: "4T Motorcycle Engine Oil", category: "lubricant", unit: "L", defaultPrice: 15000 },
];

const FALLBACK_OUTLETS = [
  {
    id: "fout_total_lugogo",
    station_id: "station_total",
    station_name: "TotalEnergies",
    name: "TotalEnergies Lugogo Bypass",
    code: "GAS-TOT-01",
    address: "Lugogo Bypass / Jinja Road, Kampala",
    lat: 0.3275,
    lng: 32.6021,
    phone: "+256700100001",
    active_pumps: 6,
    status: "active",
  },
  {
    id: "fout_shell_bugolobi",
    station_id: "station_shell",
    station_name: "Shell (Vivo Energy)",
    name: "Shell Bugolobi",
    code: "GAS-SHL-02",
    address: "Spring Road, Bugolobi, Kampala",
    lat: 0.3168,
    lng: 32.6184,
    phone: "+256700100002",
    active_pumps: 4,
    status: "active",
  },
  {
    id: "fout_rubis_kibuye",
    station_id: "station_rubis",
    station_name: "Rubis Energy",
    name: "Rubis Kibuye Roundabout",
    code: "GAS-RUB-03",
    address: "Entebbe Road, Kibuye, Kampala",
    lat: 0.2982,
    lng: 32.5714,
    phone: "+256700100003",
    active_pumps: 4,
    status: "active",
  },
  {
    id: "fout_stabex_nansana",
    station_id: "station_stabex",
    station_name: "Stabex International",
    name: "Stabex Nansana",
    code: "GAS-STB-04",
    address: "Hoima Road, Nansana, Wakiso",
    lat: 0.3642,
    lng: 32.5298,
    phone: "+256700100004",
    active_pumps: 6,
    status: "active",
  },
  {
    id: "fout_hass_wandegeya",
    station_id: "station_hass",
    station_name: "Hass Petroleum",
    name: "Hass Wandegeya",
    code: "GAS-HSS-05",
    address: "Bombo Road, Wandegeya, Kampala",
    lat: 0.3341,
    lng: 32.5721,
    phone: "+256700100005",
    active_pumps: 4,
    status: "active",
  },
  {
    id: "fout_cityoil_bombo",
    station_id: "station_cityoil",
    station_name: "CityOil",
    name: "CityOil Bombo Road",
    code: "GAS-CTY-06",
    address: "Bombo Road / Makerere Hill, Kampala",
    lat: 0.3295,
    lng: 32.5694,
    phone: "+256700100006",
    active_pumps: 6,
    status: "active",
  },
];

let schemaEnsured = false;

/** Automatically provision gas tables and base seed data if not yet present in D1 */
async function ensureGasSchema() {
  if (schemaEnsured) return;
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_stations (
        id TEXT PRIMARY KEY,
        brand_name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        logo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_station_outlets (
        id TEXT PRIMARY KEY,
        station_id TEXT NOT NULL REFERENCES fuel_stations(id),
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        address TEXT,
        lat REAL,
        lng REAL,
        phone TEXT,
        active_pumps INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'L',
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_station_prices (
        outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
        product_id TEXT NOT NULL REFERENCES fuel_products(id),
        price_per_unit INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (outlet_id, product_id)
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_pump_attendants (
        id TEXT PRIMARY KEY,
        outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
        user_id TEXT,
        attendant_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        pump_lane TEXT,
        status TEXT NOT NULL DEFAULT 'on_duty',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        rider_id TEXT NOT NULL,
        vehicle_plate TEXT NOT NULL,
        authorized_amount_ugx INTEGER NOT NULL,
        fuel_product_id TEXT,
        outlet_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL DEFAULT 'rider_wallet',
        expires_at TEXT NOT NULL,
        dispensed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_dispenses (
        id TEXT PRIMARY KEY,
        code_id TEXT,
        outlet_id TEXT NOT NULL,
        attendant_id TEXT,
        rider_id TEXT NOT NULL,
        vehicle_plate TEXT NOT NULL,
        product_id TEXT NOT NULL,
        price_per_litre INTEGER NOT NULL,
        litres_dispensed REAL NOT NULL,
        total_ugx INTEGER NOT NULL,
        pump_number INTEGER,
        receipt_ref TEXT UNIQUE NOT NULL,
        environment TEXT NOT NULL DEFAULT 'live',
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fuel_attendant_shifts (
        id TEXT PRIMARY KEY,
        attendant_id TEXT NOT NULL,
        outlet_id TEXT NOT NULL,
        opened_at TEXT NOT NULL DEFAULT (datetime('now')),
        closed_at TEXT,
        start_pump_meter REAL DEFAULT 0,
        end_pump_meter REAL,
        total_dispenses INTEGER NOT NULL DEFAULT 0,
        total_litres REAL NOT NULL DEFAULT 0,
        total_amount_ugx INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Seed fuel products
    await db.execute(`
      INSERT OR IGNORE INTO fuel_products (id, name, category, unit, sort_order, active) VALUES
        ('prod_petrol', 'Unleaded Petrol', 'fuel', 'L', 10, 1),
        ('prod_diesel', 'Ultra Low Sulphur Diesel', 'fuel', 'L', 20, 1),
        ('prod_vpower', 'Shell V-Power / Excellium', 'fuel', 'L', 30, 1),
        ('prod_oil_2t', '2T Two-Stroke Boda Oil', 'lubricant', 'L', 40, 1),
        ('prod_oil_4t', '4T Motorcycle Engine Oil', 'lubricant', 'L', 50, 1);
    `);

    // Seed stations
    await db.execute(`
      INSERT OR IGNORE INTO fuel_stations (id, brand_name, company_name, status) VALUES
        ('station_total', 'TotalEnergies', 'TotalEnergies Marketing Uganda Ltd', 'active'),
        ('station_shell', 'Shell (Vivo Energy)', 'Vivo Energy Uganda Ltd', 'active'),
        ('station_rubis', 'Rubis Energy', 'Rubis Energy Uganda Ltd', 'active'),
        ('station_stabex', 'Stabex International', 'Stabex International Ltd', 'active'),
        ('station_hass', 'Hass Petroleum', 'Hass Petroleum Uganda Ltd', 'active'),
        ('station_cityoil', 'CityOil', 'CityOil Uganda Ltd', 'active');
    `);

    // Seed outlets
    await db.execute(`
      INSERT OR IGNORE INTO fuel_station_outlets (id, station_id, name, code, address, lat, lng, phone, active_pumps, status) VALUES
        ('fout_total_lugogo', 'station_total', 'TotalEnergies Lugogo Bypass', 'GAS-TOT-01', 'Lugogo Bypass / Jinja Road, Kampala', 0.3275, 32.6021, '+256700100001', 6, 'active'),
        ('fout_shell_bugolobi', 'station_shell', 'Shell Bugolobi', 'GAS-SHL-02', 'Spring Road, Bugolobi, Kampala', 0.3168, 32.6184, '+256700100002', 4, 'active'),
        ('fout_rubis_kibuye', 'station_rubis', 'Rubis Kibuye Roundabout', 'GAS-RUB-03', 'Entebbe Road, Kibuye, Kampala', 0.2982, 32.5714, '+256700100003', 4, 'active'),
        ('fout_stabex_nansana', 'station_stabex', 'Stabex Nansana', 'GAS-STB-04', 'Hoima Road, Nansana, Wakiso', 0.3642, 32.5298, '+256700100004', 6, 'active'),
        ('fout_hass_wandegeya', 'station_hass', 'Hass Wandegeya', 'GAS-HSS-05', 'Bombo Road, Wandegeya, Kampala', 0.3341, 32.5721, '+256700100005', 4, 'active'),
        ('fout_cityoil_bombo', 'station_cityoil', 'CityOil Bombo Road', 'GAS-CTY-06', 'Bombo Road / Makerere Hill, Kampala', 0.3295, 32.5694, '+256700100006', 6, 'active');
    `);

    // Seed prices
    await db.execute(`
      INSERT OR IGNORE INTO fuel_station_prices (outlet_id, product_id, price_per_unit) VALUES
        ('fout_total_lugogo', 'prod_petrol', 5450),
        ('fout_total_lugogo', 'prod_diesel', 5150),
        ('fout_total_lugogo', 'prod_vpower', 5850),
        ('fout_total_lugogo', 'prod_oil_2t', 12000),
        ('fout_total_lugogo', 'prod_oil_4t', 15000),
        ('fout_shell_bugolobi', 'prod_petrol', 5470),
        ('fout_shell_bugolobi', 'prod_diesel', 5170),
        ('fout_shell_bugolobi', 'prod_vpower', 5890),
        ('fout_shell_bugolobi', 'prod_oil_2t', 12500),
        ('fout_shell_bugolobi', 'prod_oil_4t', 15500),
        ('fout_rubis_kibuye', 'prod_petrol', 5430),
        ('fout_rubis_kibuye', 'prod_diesel', 5130),
        ('fout_rubis_kibuye', 'prod_oil_2t', 11800),
        ('fout_rubis_kibuye', 'prod_oil_4t', 14800),
        ('fout_stabex_nansana', 'prod_petrol', 5390),
        ('fout_stabex_nansana', 'prod_diesel', 5090),
        ('fout_stabex_nansana', 'prod_oil_2t', 11500),
        ('fout_stabex_nansana', 'prod_oil_4t', 14500),
        ('fout_hass_wandegeya', 'prod_petrol', 5420),
        ('fout_hass_wandegeya', 'prod_diesel', 5120),
        ('fout_hass_wandegeya', 'prod_oil_2t', 11900),
        ('fout_hass_wandegeya', 'prod_oil_4t', 14900),
        ('fout_cityoil_bombo', 'prod_petrol', 5440),
        ('fout_cityoil_bombo', 'prod_diesel', 5140),
        ('fout_cityoil_bombo', 'prod_oil_2t', 12000),
        ('fout_cityoil_bombo', 'prod_oil_4t', 15000);
    `);

    // Seed default attendants
    await db.execute(`
      INSERT OR IGNORE INTO fuel_pump_attendants (id, outlet_id, attendant_code, full_name, phone, pump_lane, status) VALUES
        ('fatt_lugogo_1', 'fout_total_lugogo', 'ATT-1001', 'Kato Dennis', '+256701111001', 'Pump 2 (Boda Lane)', 'on_duty'),
        ('fatt_bugolobi_1', 'fout_shell_bugolobi', 'ATT-1002', 'Nakato Sarah', '+256701111002', 'Pump 1 (Quick Lane)', 'on_duty'),
        ('fatt_stabex_1', 'fout_stabex_nansana', 'ATT-1003', 'Mugisha Paul', '+256701111003', 'Pump 4', 'on_duty');
    `);

    schemaEnsured = true;
  } catch (e) {
    console.warn("Gas schema provision note:", e);
  }
}

// Automatically ensure schema on all gas endpoints
gasRoutes.use("*", async (_c, next) => {
  await ensureGasSchema();
  await next();
});

/** Helper to extract authenticated user from Bearer token */
async function getAuthUser(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  try {
    const payload = await verifyToken(token);
    const res = await db.execute({
      sql: "SELECT id, name, phone, email, role FROM users WHERE id = ?",
      args: [payload.sub],
    });
    return res.rows[0] as any ?? null;
  } catch {
    return null;
  }
}

/** Check service switch and config */
gasRoutes.get("/status", async (c) => {
  try {
    const settings = await getGasSettings();
    return c.json({ ok: true, settings });
  } catch {
    return c.json({
      ok: true,
      settings: {
        enabled: true,
        dailyLimitUgx: 60000,
        carDailyLimitUgx: 500000,
        voucherExpiryMinutes: 60,
        platformDiscountPercent: 0,
      },
    });
  }
});

/** List all partner stations & outlets with current prices */
gasRoutes.get("/stations", async (c) => {
  try {
    const query = `
      SELECT 
        o.id, o.station_id, s.brand_name AS station_name, o.name, o.code,
        o.address, o.lat, o.lng, o.phone, o.active_pumps, o.status
      FROM fuel_station_outlets o
      JOIN fuel_stations s ON s.id = o.station_id
      WHERE o.status = 'active'
      ORDER BY s.brand_name, o.name
    `;
    const res = await db.execute(query);
    const outlets = res.rows as any[];

    const pricesRes = await db.execute(`
      SELECT p.outlet_id, p.product_id, prod.name as product_name, prod.category, prod.unit, p.price_per_unit
      FROM fuel_station_prices p
      JOIN fuel_products prod ON prod.id = p.product_id
      WHERE prod.active = 1
    `);
    const prices = pricesRes.rows as any[];

    const pricesByOutlet = new Map<string, any[]>();
    for (const p of prices) {
      const list = pricesByOutlet.get(p.outlet_id) ?? [];
      list.push(p);
      pricesByOutlet.set(p.outlet_id, list);
    }

    const result = outlets.map((o) => ({
      ...o,
      prices: pricesByOutlet.get(o.id) ?? FALLBACK_PRODUCTS.map((prod) => ({
        product_id: prod.id,
        product_name: prod.name,
        category: prod.category,
        unit: prod.unit,
        price_per_unit: prod.defaultPrice,
      })),
    }));

    return c.json({ outlets: result });
  } catch {
    const outletsWithPrices = FALLBACK_OUTLETS.map((outlet) => ({
      ...outlet,
      prices: FALLBACK_PRODUCTS.map((p) => ({
        product_id: p.id,
        product_name: p.name,
        category: p.category,
        unit: p.unit,
        price_per_unit: p.defaultPrice,
      })),
    }));
    return c.json({ outlets: outletsWithPrices });
  }
});

/** List fuel products */
gasRoutes.get("/products", async (c) => {
  try {
    const res = await db.execute("SELECT id, name, category, unit FROM fuel_products WHERE active = 1 ORDER BY sort_order");
    return c.json({ products: res.rows.length > 0 ? res.rows : FALLBACK_PRODUCTS });
  } catch {
    return c.json({ products: FALLBACK_PRODUCTS });
  }
});

/** Get pump prices for a specific outlet */
gasRoutes.get("/outlets/:outletId/prices", async (c) => {
  const outletId = c.req.param("outletId");
  try {
    const res = await db.execute({
      sql: `
        SELECT p.product_id, prod.name as product_name, prod.category, prod.unit, p.price_per_unit, p.updated_at
        FROM fuel_station_prices p
        JOIN fuel_products prod ON prod.id = p.product_id
        WHERE p.outlet_id = ?
      `,
      args: [outletId],
    });
    if (res.rows.length > 0) {
      return c.json({ outlet_id: outletId, prices: res.rows });
    }
  } catch {}

  const defaultPrices = FALLBACK_PRODUCTS.map((prod) => ({
    product_id: prod.id,
    product_name: prod.name,
    category: prod.category,
    unit: prod.unit,
    price_per_unit: prod.defaultPrice,
  }));
  return c.json({ outlet_id: outletId, prices: defaultPrices });
});

/** Update pump prices for an outlet (station manager or attendant) */
gasRoutes.put("/outlets/:outletId/prices", async (c) => {
  const outletId = c.req.param("outletId");
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    prices: z.array(
      z.object({
        product_id: z.string(),
        price_per_unit: z.number().int().positive(),
      }),
    ),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: "Invalid prices payload" }, 400);
  }

  for (const item of parsed.data.prices) {
    await db.execute({
      sql: `
        INSERT INTO fuel_station_prices (outlet_id, product_id, price_per_unit, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(outlet_id, product_id) DO UPDATE SET
          price_per_unit = excluded.price_per_unit,
          updated_at = datetime('now')
      `,
      args: [outletId, item.product_id, item.price_per_unit],
    });
  }

  return c.json({ ok: true, updated: parsed.data.prices.length });
});

/** Attendant Authentication: Sign in by attendant badge code & PIN */
gasRoutes.post("/attendants/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    code: z.string().min(2),
    pin: z.string().optional(),
    outletId: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: "Attendant code is required" }, 400);
  }

  const normalizedCode = parsed.data.code.trim().toUpperCase();

  // Search attendant in database
  const res = await db.execute({
    sql: `
      SELECT 
        a.id, a.attendant_code, a.full_name, a.phone, a.pump_lane, a.status,
        o.id as outlet_id, o.name as outlet_name, o.code as outlet_code, o.address as outlet_address,
        o.active_pumps, s.id as station_id, s.brand_name as station_name
      FROM fuel_pump_attendants a
      JOIN fuel_station_outlets o ON o.id = a.outlet_id
      JOIN fuel_stations s ON s.id = o.station_id
      WHERE (UPPER(a.attendant_code) = ? OR a.phone = ? OR a.id = ?)
      LIMIT 1
    `,
    args: [normalizedCode, parsed.data.code.trim(), parsed.data.code.trim().toLowerCase()],
  });

  let attendant = res.rows[0] as any;

  if (!attendant) {
    // If attendant code matches standard format (ATT-...), auto-register to selected or first outlet
    const targetOutletId = parsed.data.outletId || "fout_total_lugogo";
    const newId = `fatt_${Date.now()}`;
    await db.execute({
      sql: `
        INSERT INTO fuel_pump_attendants (id, outlet_id, attendant_code, full_name, phone, pump_lane, status)
        VALUES (?, ?, ?, ?, ?, ?, 'on_duty')
      `,
      args: [newId, targetOutletId, normalizedCode, `Attendant ${normalizedCode}`, "+256 700 000 000", "Pump 1"],
    });

    const refreshed = await db.execute({
      sql: `
        SELECT 
          a.id, a.attendant_code, a.full_name, a.phone, a.pump_lane, a.status,
          o.id as outlet_id, o.name as outlet_name, o.code as outlet_code, o.address as outlet_address,
          o.active_pumps, s.id as station_id, s.brand_name as station_name
        FROM fuel_pump_attendants a
        JOIN fuel_station_outlets o ON o.id = a.outlet_id
        JOIN fuel_stations s ON s.id = o.station_id
        WHERE a.id = ?
      `,
      args: [newId],
    });
    attendant = refreshed.rows[0];
  }

  if (!attendant) {
    return c.json({ error: "not_found", message: "Invalid attendant badge code." }, 404);
  }

  // Ensure active shift record exists
  const shiftRes = await db.execute({
    sql: `
      SELECT id FROM fuel_attendant_shifts 
      WHERE attendant_id = ? AND outlet_id = ? AND status = 'open' AND date(opened_at) = date('now')
      LIMIT 1
    `,
    args: [attendant.id, attendant.outlet_id],
  });

  if (shiftRes.rows.length === 0) {
    await db.execute({
      sql: `
        INSERT INTO fuel_attendant_shifts (id, attendant_id, outlet_id, status)
        VALUES (?, ?, ?, 'open')
      `,
      args: [`fshift_${Date.now()}`, attendant.id, attendant.outlet_id],
    });
  }

  const token = `gatt_${attendant.id}_${Date.now()}`;

  return c.json({
    ok: true,
    token,
    attendant: {
      id: attendant.id,
      code: attendant.attendant_code,
      name: attendant.full_name,
      phone: attendant.phone,
      pump_lane: attendant.pump_lane ?? "Pump 1",
      on_duty: attendant.status === "on_duty",
    },
    outlet: {
      id: attendant.outlet_id,
      station_id: attendant.station_id,
      station_name: attendant.station_name,
      name: attendant.outlet_name,
      code: attendant.outlet_code,
      address: attendant.outlet_address,
      active_pumps: attendant.active_pumps,
      status: "active",
    },
  });
});

/** Attendant Portal: Get current attendant profile and outlet */
gasRoutes.get("/me", async (c) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return c.json({ error: "unauthorized", message: "Missing attendant token" }, 401);
  }

  const attendantIdMatch = token.match(/^gatt_(fatt_[a-zA-Z0-9_]+)_/);
  const attendantId = attendantIdMatch ? attendantIdMatch[1] : null;

  let attendantRow: any = null;
  if (attendantId) {
    const res = await db.execute({
      sql: `
        SELECT 
          a.id, a.attendant_code, a.full_name, a.phone, a.pump_lane, a.status,
          o.id as outlet_id, o.name as outlet_name, o.code as outlet_code, o.address as outlet_address,
          o.active_pumps, s.id as station_id, s.brand_name as station_name
        FROM fuel_pump_attendants a
        JOIN fuel_station_outlets o ON o.id = a.outlet_id
        JOIN fuel_stations s ON s.id = o.station_id
        WHERE a.id = ?
        LIMIT 1
      `,
      args: [attendantId],
    });
    attendantRow = res.rows[0];
  }

  if (!attendantRow) {
    // Default fallback to first attendant
    const firstRes = await db.execute(`
      SELECT 
        a.id, a.attendant_code, a.full_name, a.phone, a.pump_lane, a.status,
        o.id as outlet_id, o.name as outlet_name, o.code as outlet_code, o.address as outlet_address,
        o.active_pumps, s.id as station_id, s.brand_name as station_name
      FROM fuel_pump_attendants a
      JOIN fuel_station_outlets o ON o.id = a.outlet_id
      JOIN fuel_stations s ON s.id = o.station_id
      LIMIT 1
    `);
    attendantRow = firstRes.rows[0];
  }

  if (!attendantRow) {
    return c.json({ error: "unauthorized", message: "Attendant session expired" }, 401);
  }

  return c.json({
    ok: true,
    attendant: {
      id: attendantRow.id,
      code: attendantRow.attendant_code,
      name: attendantRow.full_name,
      phone: attendantRow.phone,
      pump_lane: attendantRow.pump_lane ?? "Pump 1",
      on_duty: attendantRow.status === "on_duty",
    },
    outlet: {
      id: attendantRow.outlet_id,
      station_id: attendantRow.station_id,
      station_name: attendantRow.station_name,
      name: attendantRow.outlet_name,
      code: attendantRow.outlet_code,
      address: attendantRow.outlet_address,
      active_pumps: attendantRow.active_pumps,
      status: "active",
    },
  });
});

/** Attendant Portal: Toggle on duty status */
gasRoutes.post("/attendants/toggle-duty", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const onDuty = Boolean(body.onDuty);
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const match = token.match(/^gatt_(fatt_[a-zA-Z0-9_]+)_/);
  const attendantId = match ? match[1] : "fatt_lugogo_1";

  await db.execute({
    sql: "UPDATE fuel_pump_attendants SET status = ? WHERE id = ?",
    args: [onDuty ? "on_duty" : "off_duty", attendantId],
  });

  return c.json({ ok: true, on_duty: onDuty });
});

/** Verify fuel code scanned or entered by attendant */
gasRoutes.post("/verify-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawCode = String(body.code ?? "").trim().toUpperCase();
  const outletId = String(body.outletId ?? "fout_total_lugogo");

  if (!rawCode) {
    return c.json({ error: "bad_request", message: "Code is required" }, 400);
  }

  const normalizedCode = rawCode.startsWith("PBGAS-") ? rawCode : `PBGAS-${rawCode}`;
  const shortCode = rawCode.replace(/^PBGAS-/, "");

  const res = await db.execute({
    sql: `
      SELECT c.*, u.name as user_name, u.phone as user_phone
      FROM fuel_codes c
      LEFT JOIN users u ON u.id = c.rider_id
      WHERE (c.code = ? OR c.code = ? OR c.code LIKE ?)
      ORDER BY c.created_at DESC
      LIMIT 1
    `,
    args: [normalizedCode, shortCode, `%${shortCode}%`],
  });

  const codeRecord = res.rows[0] as any;

  if (!codeRecord) {
    return c.json({
      error: "not_found",
      message: "Invalid or unknown fuel voucher code. Please check the code with the customer.",
    }, 404);
  }

  if (codeRecord.status === "dispensed") {
    return c.json({ error: "already_used", message: "This voucher has already been redeemed and fuel dispensed." }, 400);
  }

  if (codeRecord.status === "cancelled") {
    return c.json({ error: "cancelled", message: "This fuel voucher was cancelled by the customer." }, 400);
  }

  if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
    return c.json({ error: "expired", message: "This fuel voucher has expired. Please ask customer to generate a fresh code." }, 400);
  }

  // Fetch outlet prices
  let prices: any[] = [];
  try {
    const pRes = await db.execute({
      sql: `
        SELECT p.product_id, prod.name as product_name, prod.category, prod.unit, p.price_per_unit
        FROM fuel_station_prices p
        JOIN fuel_products prod ON prod.id = p.product_id
        WHERE p.outlet_id = ?
      `,
      args: [outletId],
    });
    prices = pRes.rows as any[];
  } catch {}

  if (prices.length === 0) {
    prices = FALLBACK_PRODUCTS.map((prod) => ({
      product_id: prod.id,
      product_name: prod.name,
      category: prod.category,
      unit: prod.unit,
      price_per_unit: prod.defaultPrice,
    }));
  }

  // Detect vehicle type (car vs motorcycle)
  let vehicleType: "car" | "motorcycle" = "motorcycle";
  let vehicleDesc = "Peebee Rider";
  const plate = String(codeRecord.vehicle_plate ?? "").toUpperCase();
  const isCarPlate = plate.startsWith("UB") || plate.startsWith("UA") || plate.startsWith("PRACTICE");
  if (isCarPlate) {
    vehicleType = "car";
    vehicleDesc = "Peebee Fleet Car";
  }

  try {
    const vRes = await db.execute({
      sql: "SELECT make, model, year FROM vehicles WHERE UPPER(plate) = ? LIMIT 1",
      args: [plate],
    });
    if (vRes.rows.length > 0) {
      const v = vRes.rows[0] as any;
      vehicleType = "car";
      vehicleDesc = `${v.make ?? ""} ${v.model ?? ""}`.trim() || "Peebee Fleet Car";
    }
  } catch {}

  const customerName = codeRecord.user_name ?? (vehicleType === "car" ? "Verified Car Driver" : "Verified Motorcycle Rider");

  return c.json({
    valid: true,
    code: {
      id: codeRecord.id,
      code: codeRecord.code,
      rider_id: codeRecord.rider_id,
      rider_name: customerName,
      rider_phone: codeRecord.user_phone ?? "+256 700 000 000",
      rider_stage: vehicleType === "car" ? "Peebee Car Fleet" : "Kampala Central Stage",
      vehicle_plate: codeRecord.vehicle_plate,
      vehicle_type: vehicleType,
      vehicle_desc: vehicleDesc,
      authorized_amount_ugx: Number(codeRecord.authorized_amount_ugx),
      fuel_product_id: codeRecord.fuel_product_id,
      status: codeRecord.status,
      expires_at: codeRecord.expires_at,
    },
    outlet_prices: prices,
  });
});

/** Dispense fuel and generate digital receipt */
gasRoutes.post("/dispense", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    code: z.string(),
    outletId: z.string(),
    productId: z.string().default("prod_petrol"),
    attendantId: z.string().optional(),
    attendantName: z.string().optional(),
    pumpNumber: z.number().int().min(1).max(20).default(1),
    litres: z.number().positive().optional(),
    totalUgx: z.number().int().positive().optional(),
    odometer: z.number().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: "Invalid dispense parameters" }, 400);
  }

  const { code, outletId, productId, attendantId, attendantName, pumpNumber } = parsed.data;
  let { litres, totalUgx } = parsed.data;

  // Find price per litre
  let pricePerLitre = 5450;
  try {
    const pRes = await db.execute({
      sql: `SELECT price_per_unit FROM fuel_station_prices WHERE outlet_id = ? AND product_id = ?`,
      args: [outletId, productId],
    });
    if (pRes.rows[0]) pricePerLitre = Number(pRes.rows[0].price_per_unit);
  } catch {}

  // Reconcile litres & UGX
  if (litres != null && totalUgx == null) {
    totalUgx = Math.round(litres * pricePerLitre);
  } else if (totalUgx != null && litres == null) {
    litres = Math.round((totalUgx / pricePerLitre) * 100) / 100;
  } else if (totalUgx == null && litres == null) {
    return c.json({ error: "bad_request", message: "Specify either litres or total UGX" }, 400);
  }

  // Lookup code record in DB
  const normalizedCode = code.toUpperCase().startsWith("PBGAS-") ? code.toUpperCase() : `PBGAS-${code.toUpperCase()}`;
  const shortCode = code.toUpperCase().replace(/^PBGAS-/, "");

  const cRes = await db.execute({
    sql: `
      SELECT c.*, u.name as user_name 
      FROM fuel_codes c 
      LEFT JOIN users u ON u.id = c.rider_id 
      WHERE c.code = ? OR c.code = ? OR c.code LIKE ? 
      ORDER BY c.created_at DESC 
      LIMIT 1
    `,
    args: [normalizedCode, shortCode, `%${shortCode}%`],
  });

  const codeRecord = cRes.rows[0] as any;

  if (!codeRecord) {
    return c.json({ error: "not_found", message: "Fuel voucher code not found." }, 404);
  }

  if (codeRecord.authorized_amount_ugx < totalUgx!) {
    return c.json({
      error: "limit_exceeded",
      message: `Amount UGX ${totalUgx!.toLocaleString()} exceeds customer authorized limit of UGX ${Number(codeRecord.authorized_amount_ugx).toLocaleString()}`,
    }, 400);
  }

  const receiptRef = `RCP-GAS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dispenseId = `fdisp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Find outlet brand name
  let outletName = "TotalEnergies Lugogo Bypass";
  let stationName = "TotalEnergies";
  try {
    const oRes = await db.execute({
      sql: `
        SELECT o.name as outlet_name, s.brand_name as station_name 
        FROM fuel_station_outlets o 
        JOIN fuel_stations s ON s.id = o.station_id 
        WHERE o.id = ?
      `,
      args: [outletId],
    });
    if (oRes.rows[0]) {
      outletName = String(oRes.rows[0].outlet_name);
      stationName = String(oRes.rows[0].station_name);
    }
  } catch {}

  // Find product name
  let productName = "Unleaded Petrol";
  try {
    const prRes = await db.execute({ sql: "SELECT name FROM fuel_products WHERE id = ?", args: [productId] });
    if (prRes.rows[0]?.name) productName = String(prRes.rows[0].name);
  } catch {}

  // Record dispense in DB
  await db.execute({
    sql: `
      INSERT INTO fuel_dispenses (
        id, code_id, outlet_id, attendant_id, rider_id, vehicle_plate,
        product_id, price_per_litre, litres_dispensed, total_ugx, pump_number, receipt_ref, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    args: [
      dispenseId,
      codeRecord.id,
      outletId,
      attendantId ?? null,
      codeRecord.rider_id,
      codeRecord.vehicle_plate ?? "UFE 429K",
      productId,
      pricePerLitre,
      litres!,
      totalUgx!,
      pumpNumber,
      receiptRef,
    ],
  });

  // Mark code as dispensed
  await db.execute({
    sql: `UPDATE fuel_codes SET status = 'dispensed', dispensed_at = datetime('now') WHERE id = ?`,
    args: [codeRecord.id],
  });

  // Update attendant shift aggregate
  try {
    await db.execute({
      sql: `
        UPDATE fuel_attendant_shifts 
        SET 
          total_dispenses = total_dispenses + 1,
          total_litres = total_litres + ?,
          total_amount_ugx = total_amount_ugx + ?
        WHERE outlet_id = ? AND status = 'open' AND date(opened_at) = date('now')
      `,
      args: [litres!, totalUgx!, outletId],
    });
  } catch {}

  const receipt = {
    id: dispenseId,
    receipt_ref: receiptRef,
    code_id: codeRecord.id,
    outlet_id: outletId,
    outlet_name: outletName,
    station_name: stationName,
    attendant_id: attendantId ?? "att_duty",
    attendant_name: attendantName ?? "Pump Attendant",
    rider_id: codeRecord.rider_id,
    rider_name: codeRecord.user_name ?? "Peebee Customer",
    vehicle_plate: codeRecord.vehicle_plate,
    product_id: productId,
    product_name: productName,
    price_per_litre: pricePerLitre,
    litres_dispensed: litres!,
    total_ugx: totalUgx!,
    pump_number: pumpNumber,
    status: "completed",
    created_at: now,
  };

  return c.json({ ok: true, receipt });
});

/** Get recent dispenses for an outlet */
gasRoutes.get("/dispenses", async (c) => {
  const outletId = c.req.query("outletId");
  try {
    let sql = `
      SELECT 
        d.*, o.name as outlet_name, s.brand_name as station_name,
        p.name as product_name, u.name as rider_name
      FROM fuel_dispenses d
      JOIN fuel_station_outlets o ON o.id = d.outlet_id
      JOIN fuel_stations s ON s.id = o.station_id
      JOIN fuel_products p ON p.id = d.product_id
      LEFT JOIN users u ON u.id = d.rider_id
    `;
    const args: any[] = [];
    if (outletId) {
      sql += ` WHERE d.outlet_id = ? `;
      args.push(outletId);
    }
    sql += ` ORDER BY d.created_at DESC LIMIT 50`;

    const res = await db.execute({ sql, args });
    return c.json({ dispenses: res.rows });
  } catch {
    return c.json({ dispenses: [] });
  }
});

/** Get shift summary */
gasRoutes.get("/shift/summary", async (c) => {
  const outletId = c.req.query("outletId") ?? "fout_total_lugogo";
  try {
    const res = await db.execute({
      sql: `
        SELECT 
          COUNT(*) as total_dispenses,
          COALESCE(SUM(litres_dispensed), 0) as total_litres,
          COALESCE(SUM(total_ugx), 0) as total_ugx
        FROM fuel_dispenses
        WHERE outlet_id = ? AND date(created_at) = date('now')
      `,
      args: [outletId],
    });

    const recentRes = await db.execute({
      sql: `
        SELECT 
          d.*, p.name as product_name, u.name as rider_name
        FROM fuel_dispenses d
        JOIN fuel_products p ON p.id = d.product_id
        LEFT JOIN users u ON u.id = d.rider_id
        WHERE d.outlet_id = ? AND date(d.created_at) = date('now')
        ORDER BY d.created_at DESC LIMIT 10
      `,
      args: [outletId],
    });

    const row = res.rows[0] as any;
    return c.json({
      summary: {
        outlet_id: outletId,
        total_dispenses: Number(row?.total_dispenses ?? 0),
        total_litres: Math.round(Number(row?.total_litres ?? 0) * 100) / 100,
        total_ugx: Number(row?.total_ugx ?? 0),
        recent: recentRes.rows ?? [],
      },
    });
  } catch {
    return c.json({
      summary: {
        outlet_id: outletId,
        total_dispenses: 0,
        total_litres: 0,
        total_ugx: 0,
        recent: [],
      },
    });
  }
});

/** Generate a new fuel code / voucher (Motorcycle Rider or Car Driver) */
gasRoutes.post("/rider/generate-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    riderId: z.string().optional(),
    vehiclePlate: z.string().default("UFE 429K"),
    amountUgx: z.number().int().min(5000).max(500000).default(20000),
    productId: z.string().default("prod_petrol"),
    outletId: z.string().optional(),
    vehicleType: z.enum(["motorcycle", "car"]).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: "Invalid code generation parameters" }, 400);
  }

  // Check auth user if available
  const authUser = await getAuthUser(c.req.header("Authorization"));
  const riderId = authUser?.id ?? parsed.data.riderId ?? "user_rider_verified";
  let vehiclePlate = parsed.data.vehiclePlate;

  // Auto-lookup registered car/bike plate if user didn't specify one
  if (authUser && (!vehiclePlate || vehiclePlate === "UFE 429K")) {
    try {
      const vRes = await db.execute({
        sql: "SELECT plate FROM vehicles WHERE user_id = ? OR driver_id = ? LIMIT 1",
        args: [authUser.id, authUser.id],
      });
      if (vRes.rows[0]?.plate) vehiclePlate = String(vRes.rows[0].plate);
    } catch {}
  }

  // Generate 6-digit numeric code
  const sixDigit = String(Math.floor(100000 + Math.random() * 900000));
  const fullCode = `PBGAS-${sixDigit}`;
  const codeId = `fcode_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Persist directly to DB
  await db.execute({
    sql: `
      INSERT INTO fuel_codes (
        id, code, rider_id, vehicle_plate, authorized_amount_ugx,
        fuel_product_id, outlet_id, status, source, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'rider_wallet', ?, datetime('now'))
    `,
    args: [
      codeId,
      fullCode,
      riderId,
      vehiclePlate,
      parsed.data.amountUgx,
      parsed.data.productId,
      parsed.data.outletId ?? null,
      expiresAt,
    ],
  });

  const codeRecord = {
    id: codeId,
    code: fullCode,
    short_code: sixDigit,
    rider_id: riderId,
    rider_name: authUser?.name ?? (parsed.data.vehicleType === "car" ? "Verified Car Driver" : "Verified Motorcycle Rider"),
    vehicle_plate: vehiclePlate,
    authorized_amount_ugx: parsed.data.amountUgx,
    fuel_product_id: parsed.data.productId,
    outlet_id: parsed.data.outletId ?? null,
    status: "active",
    source: "rider_wallet",
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  return c.json({ ok: true, code: codeRecord });
});

/** Get rider active fuel code */
gasRoutes.get("/rider/active-code", async (c) => {
  const authUser = await getAuthUser(c.req.header("Authorization"));
  const riderId = authUser?.id ?? c.req.query("riderId");

  try {
    let sql = `
      SELECT c.*, u.name as rider_name 
      FROM fuel_codes c 
      LEFT JOIN users u ON u.id = c.rider_id
      WHERE c.status = 'active' AND c.expires_at > datetime('now')
    `;
    const args: any[] = [];
    if (riderId) {
      sql += ` AND c.rider_id = ? `;
      args.push(riderId);
    }
    sql += ` ORDER BY c.created_at DESC LIMIT 1`;

    const res = await db.execute({ sql, args });
    return c.json({ code: res.rows[0] ?? null });
  } catch {
    return c.json({ code: null });
  }
});
