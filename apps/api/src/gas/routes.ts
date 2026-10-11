import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";
import { getGasSettings } from "../lib/settings.js";
import { requireAuth } from "../auth/middleware.js";

export const gasRoutes = new Hono();

// Fallback in-memory defaults when running before DB migration
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

// In-memory store for fallback mode
const inMemoryCodes = new Map<string, any>();
const inMemoryDispenses: any[] = [];
const inMemoryPrices = new Map<string, number>();

// Seed in-memory prices
for (const outlet of FALLBACK_OUTLETS) {
  for (const prod of FALLBACK_PRODUCTS) {
    inMemoryPrices.set(`${outlet.id}:${prod.id}`, prod.defaultPrice);
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
        voucherExpiryMinutes: 60,
        platformDiscountPercent: 0,
      },
    });
  }
});

/** List all partner stations & outlets with current prices */
gasRoutes.get("/stations", async (c) => {
  const ready = await hasTable("fuel_station_outlets");
  if (!ready) {
    const outletsWithPrices = FALLBACK_OUTLETS.map((outlet) => ({
      ...outlet,
      prices: FALLBACK_PRODUCTS.map((p) => ({
        product_id: p.id,
        product_name: p.name,
        category: p.category,
        unit: p.unit,
        price_per_unit: inMemoryPrices.get(`${outlet.id}:${p.id}`) ?? p.defaultPrice,
      })),
    }));
    return c.json({ outlets: outletsWithPrices });
  }

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

  // Fetch prices
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
});

/** List fuel products */
gasRoutes.get("/products", async (c) => {
  const ready = await hasTable("fuel_products");
  if (!ready) {
    return c.json({ products: FALLBACK_PRODUCTS });
  }
  const res = await db.execute("SELECT id, name, category, unit FROM fuel_products WHERE active = 1 ORDER BY sort_order");
  return c.json({ products: res.rows });
});

/** Get pump prices for a specific outlet */
gasRoutes.get("/outlets/:outletId/prices", async (c) => {
  const outletId = c.req.param("outletId");
  const ready = await hasTable("fuel_station_prices");
  if (!ready) {
    const prices = FALLBACK_PRODUCTS.map((prod) => ({
      product_id: prod.id,
      product_name: prod.name,
      category: prod.category,
      unit: prod.unit,
      price_per_unit: inMemoryPrices.get(`${outletId}:${prod.id}`) ?? prod.defaultPrice,
    }));
    return c.json({ outlet_id: outletId, prices });
  }

  const res = await db.execute({
    sql: `
      SELECT p.product_id, prod.name as product_name, prod.category, prod.unit, p.price_per_unit, p.updated_at
      FROM fuel_station_prices p
      JOIN fuel_products prod ON prod.id = p.product_id
      WHERE p.outlet_id = ?
    `,
    args: [outletId],
  });

  return c.json({ outlet_id: outletId, prices: res.rows });
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

  const ready = await hasTable("fuel_station_prices");
  if (!ready) {
    for (const item of parsed.data.prices) {
      inMemoryPrices.set(`${outletId}:${item.product_id}`, item.price_per_unit);
    }
    return c.json({ ok: true, updated: parsed.data.prices.length });
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

/** Verify fuel code scanned or entered by attendant */
gasRoutes.post("/verify-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawCode = String(body.code ?? "").trim().toUpperCase();
  const outletId = String(body.outletId ?? "fout_total_lugogo");

  if (!rawCode) {
    return c.json({ error: "bad_request", message: "Code is required" }, 400);
  }

  // Normalize: code can be formatted as "PBGAS-738291" or raw "738291"
  const normalizedCode = rawCode.startsWith("PBGAS-") ? rawCode : `PBGAS-${rawCode}`;
  const shortCode = rawCode.replace(/^PBGAS-/, "");

  const ready = await hasTable("fuel_codes");
  let codeRecord: any = null;

  if (!ready) {
    // Check in-memory store or create demo record if none
    codeRecord = inMemoryCodes.get(normalizedCode) || inMemoryCodes.get(shortCode);
    if (!codeRecord && /^[0-9A-Z]{4,8}$/.test(shortCode)) {
      // Auto-generate test voucher for instant live demo experience
      codeRecord = {
        id: `fcode_demo_${shortCode}`,
        code: normalizedCode,
        rider_id: "user_demo_rider",
        rider_name: "Okello Ronald",
        rider_phone: "+256 701 445 892",
        rider_stage: "Clock Tower Boda Stage",
        vehicle_plate: "UFE 429K",
        authorized_amount_ugx: 25000,
        fuel_product_id: "prod_petrol",
        status: "active",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
      inMemoryCodes.set(normalizedCode, codeRecord);
      inMemoryCodes.set(shortCode, codeRecord);
    }
  } else {
    const res = await db.execute({
      sql: `
        SELECT c.*, u.name as rider_name, u.phone as rider_phone
        FROM fuel_codes c
        JOIN users u ON u.id = c.rider_id
        WHERE (c.code = ? OR c.code = ? OR c.code LIKE ?)
        LIMIT 1
      `,
      args: [normalizedCode, shortCode, `%${shortCode}%`],
    });
    codeRecord = res.rows[0];
  }

  if (!codeRecord) {
    return c.json({ error: "not_found", message: "Invalid or unknown fuel voucher code." }, 404);
  }

  if (codeRecord.status === "dispensed") {
    return c.json({ error: "already_used", message: "This code was already used and fuel dispensed." }, 400);
  }

  if (codeRecord.status === "cancelled") {
    return c.json({ error: "cancelled", message: "This fuel code was cancelled by the rider." }, 400);
  }

  // Check expiry
  if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
    return c.json({ error: "expired", message: "This fuel code has expired." }, 400);
  }

  // Fetch outlet prices
  let prices: any[] = [];
  if (ready && (await hasTable("fuel_station_prices"))) {
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
  }

  if (prices.length === 0) {
    prices = FALLBACK_PRODUCTS.map((prod) => ({
      product_id: prod.id,
      product_name: prod.name,
      category: prod.category,
      unit: prod.unit,
      price_per_unit: inMemoryPrices.get(`${outletId}:${prod.id}`) ?? prod.defaultPrice,
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
  if (ready) {
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
  }

  return c.json({
    valid: true,
    code: {
      id: codeRecord.id,
      code: codeRecord.code,
      rider_id: codeRecord.rider_id,
      rider_name: codeRecord.rider_name ?? (vehicleType === "car" ? "Verified Car Driver" : "Verified Peebee Rider"),
      rider_phone: codeRecord.rider_phone ?? "+256 700 000 000",
      rider_stage: codeRecord.rider_stage ?? (vehicleType === "car" ? "Peebee Car Fleet" : "Kampala Central Stage"),
      vehicle_plate: codeRecord.vehicle_plate,
      vehicle_type: vehicleType,
      vehicle_desc: vehicleDesc,
      authorized_amount_ugx: codeRecord.authorized_amount_ugx,
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
  const ready = await hasTable("fuel_dispenses");

  if (ready && (await hasTable("fuel_station_prices"))) {
    const pRes = await db.execute({
      sql: `SELECT price_per_unit FROM fuel_station_prices WHERE outlet_id = ? AND product_id = ?`,
      args: [outletId, productId],
    });
    if (pRes.rows[0]) pricePerLitre = Number(pRes.rows[0].price_per_unit);
  } else {
    pricePerLitre = inMemoryPrices.get(`${outletId}:${productId}`) ?? 5450;
  }

  // Reconcile litres & UGX
  if (litres != null && totalUgx == null) {
    totalUgx = Math.round(litres * pricePerLitre);
  } else if (totalUgx != null && litres == null) {
    litres = Math.round((totalUgx / pricePerLitre) * 100) / 100;
  } else if (totalUgx == null && litres == null) {
    return c.json({ error: "bad_request", message: "Specify either litres or total UGX" }, 400);
  }

  // Lookup code record
  const normalizedCode = code.toUpperCase().startsWith("PBGAS-") ? code.toUpperCase() : `PBGAS-${code.toUpperCase()}`;
  const shortCode = code.toUpperCase().replace(/^PBGAS-/, "");
  let codeRecord: any = null;

  if (!ready) {
    codeRecord = inMemoryCodes.get(normalizedCode) || inMemoryCodes.get(shortCode);
    if (!codeRecord) {
      codeRecord = {
        id: `fcode_${Date.now()}`,
        code: normalizedCode,
        rider_id: "user_demo_rider",
        rider_name: "Okello Ronald",
        vehicle_plate: "UFE 429K",
        authorized_amount_ugx: Math.max(totalUgx!, 50000),
      };
    }
  } else {
    const res = await db.execute({
      sql: `SELECT c.*, u.name as rider_name FROM fuel_codes c JOIN users u ON u.id = c.rider_id WHERE c.code = ? OR c.code = ? OR c.code LIKE ? LIMIT 1`,
      args: [normalizedCode, shortCode, `%${shortCode}%`],
    });
    codeRecord = res.rows[0];
  }

  if (codeRecord && codeRecord.authorized_amount_ugx < totalUgx!) {
    return c.json({
      error: "limit_exceeded",
      message: `Amount UGX ${totalUgx!.toLocaleString()} exceeds rider authorized limit of UGX ${codeRecord.authorized_amount_ugx.toLocaleString()}`,
    }, 400);
  }

  const receiptRef = `RCP-GAS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dispenseId = `fdisp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Find product name and outlet name
  const outletObj = FALLBACK_OUTLETS.find((o) => o.id === outletId) ?? {
    name: "TotalEnergies Lugogo Bypass",
    station_name: "TotalEnergies",
  };
  const prodObj = FALLBACK_PRODUCTS.find((p) => p.id === productId) ?? { name: "Unleaded Petrol" };

  const receipt = {
    id: dispenseId,
    receipt_ref: receiptRef,
    code_id: codeRecord?.id,
    outlet_id: outletId,
    outlet_name: outletObj.name,
    station_name: outletObj.station_name,
    attendant_id: attendantId ?? "att_duty",
    attendant_name: attendantName ?? "Pump Attendant",
    rider_id: codeRecord?.rider_id ?? "rider_1",
    rider_name: codeRecord?.rider_name ?? "Peebee Rider",
    vehicle_plate: codeRecord?.vehicle_plate ?? "UFE 429K",
    product_id: productId,
    product_name: prodObj.name,
    price_per_litre: pricePerLitre,
    litres_dispensed: litres!,
    total_ugx: totalUgx!,
    pump_number: pumpNumber,
    status: "completed",
    created_at: now,
  };

  if (!ready) {
    if (codeRecord) codeRecord.status = "dispensed";
    inMemoryDispenses.unshift(receipt);
  } else {
    // Record dispense in DB
    await db.execute({
      sql: `
        INSERT INTO fuel_dispenses (
          id, code_id, outlet_id, attendant_id, rider_id, vehicle_plate,
          product_id, price_per_litre, litres_dispensed, total_ugx, pump_number, receipt_ref, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        dispenseId,
        codeRecord?.id ?? null,
        outletId,
        attendantId ?? null,
        codeRecord?.rider_id ?? "user_system",
        codeRecord?.vehicle_plate ?? "UFE 429K",
        productId,
        pricePerLitre,
        litres!,
        totalUgx!,
        pumpNumber,
        receiptRef,
        now,
      ],
    });

    if (codeRecord?.id) {
      await db.execute({
        sql: `UPDATE fuel_codes SET status = 'dispensed', dispensed_at = datetime('now') WHERE id = ?`,
        args: [codeRecord.id],
      });
    }
  }

  return c.json({ ok: true, receipt });
});

/** Get recent dispenses for an outlet */
gasRoutes.get("/dispenses", async (c) => {
  const outletId = c.req.query("outletId");
  const ready = await hasTable("fuel_dispenses");

  if (!ready) {
    const list = outletId ? inMemoryDispenses.filter((d) => d.outlet_id === outletId) : inMemoryDispenses;
    return c.json({ dispenses: list.slice(0, 50) });
  }

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
});

/** Get shift summary */
gasRoutes.get("/shift/summary", async (c) => {
  const outletId = c.req.query("outletId") ?? "fout_total_lugogo";
  const ready = await hasTable("fuel_dispenses");

  if (!ready) {
    const items = inMemoryDispenses.filter((d) => d.outlet_id === outletId);
    const totalUgx = items.reduce((acc, d) => acc + (d.total_ugx || 0), 0);
    const totalLitres = items.reduce((acc, d) => acc + (d.litres_dispensed || 0), 0);
    return c.json({
      summary: {
        outlet_id: outletId,
        total_dispenses: items.length,
        total_litres: Math.round(totalLitres * 100) / 100,
        total_ugx: totalUgx,
        recent: items.slice(0, 10),
      },
    });
  }

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

  const row = res.rows[0] as any;
  return c.json({
    summary: {
      outlet_id: outletId,
      total_dispenses: Number(row?.total_dispenses ?? 0),
      total_litres: Math.round(Number(row?.total_litres ?? 0) * 100) / 100,
      total_ugx: Number(row?.total_ugx ?? 0),
    },
  });
});

/** Rider endpoint: Generate a new fuel code / voucher */
gasRoutes.post("/rider/generate-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    riderId: z.string().optional(),
    vehiclePlate: z.string().default("UFE 429K"),
    amountUgx: z.number().int().min(5000).max(500000).default(20000),
    productId: z.string().default("prod_petrol"),
    outletId: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: "Invalid code generation parameters" }, 400);
  }

  // Generate 6-digit numeric code
  const sixDigit = String(Math.floor(100000 + Math.random() * 900000));
  const fullCode = `PBGAS-${sixDigit}`;
  const codeId = `fcode_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const riderId = parsed.data.riderId ?? "rider_me";

  const codeRecord = {
    id: codeId,
    code: fullCode,
    short_code: sixDigit,
    rider_id: riderId,
    vehicle_plate: parsed.data.vehiclePlate,
    authorized_amount_ugx: parsed.data.amountUgx,
    fuel_product_id: parsed.data.productId,
    outlet_id: parsed.data.outletId ?? null,
    status: "active",
    source: "rider_wallet",
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  const ready = await hasTable("fuel_codes");
  if (!ready) {
    inMemoryCodes.set(fullCode, codeRecord);
    inMemoryCodes.set(sixDigit, codeRecord);
  } else {
    await db.execute({
      sql: `
        INSERT INTO fuel_codes (
          id, code, rider_id, vehicle_plate, authorized_amount_ugx,
          fuel_product_id, outlet_id, status, source, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        codeId,
        fullCode,
        riderId,
        parsed.data.vehiclePlate,
        parsed.data.amountUgx,
        parsed.data.productId,
        parsed.data.outletId ?? null,
        "active",
        "rider_wallet",
        expiresAt,
      ],
    });
  }

  return c.json({ ok: true, code: codeRecord });
});

/** Rider endpoint: Get rider active fuel code */
gasRoutes.get("/rider/active-code", async (c) => {
  const riderId = c.req.query("riderId") ?? "rider_me";
  const ready = await hasTable("fuel_codes");

  if (!ready) {
    // Look up in memory
    for (const record of inMemoryCodes.values()) {
      if (record.rider_id === riderId && record.status === "active" && new Date(record.expires_at).getTime() > Date.now()) {
        return c.json({ code: record });
      }
    }
    return c.json({ code: null });
  }

  const res = await db.execute({
    sql: `
      SELECT * FROM fuel_codes
      WHERE rider_id = ? AND status = 'active' AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `,
    args: [riderId],
  });

  return c.json({ code: res.rows[0] ?? null });
});
