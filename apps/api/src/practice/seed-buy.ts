import { PRACTICE_ENTEBBE } from "@peebee/shared/practice-entebbe";
import { type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/**
 * Deliver and Buy extras: petrol stations with attendants, managers, prices and fuel history; relay stages and matatu
 * operators; pharmacy approvals and prescriptions; live selling, store ads and Pro subscriptions. Shopping, food and the
 * marketplace themselves are seeded in seed.ts.
 */
const E = PRACTICE_ENTEBBE;
const NO_PASSWORD = "practice-account-no-password";
const pastDays = (d: number) => `datetime('now', '-${d} days')`;

const user = (id: string, name: string, phone: string, role: "customer" | "rider" = "customer"): DbStatement => ({
  sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at) VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
  args: [id, phone, name, NO_PASSWORD, role],
});

export const PRACTICE_FUEL = [
  { n: 1, brand: "Shell", name: "Shell Entebbe Town", lat: E.lat + 0.001, lng: E.lng + 0.002, relay: 1, attendants: ["Joan Nabirye", "Kevin Okumu"], manager: "Margaret Nansubuga" },
  { n: 2, brand: "Total", name: "Total Kitoro", lat: E.lat - 0.004, lng: E.lng + 0.006, relay: 1, attendants: ["Hakim Ssali", "Dorothy Aber"], manager: "Patrick Wanyama" },
  { n: 3, brand: "Rubis", name: "Rubis Bugonga", lat: E.lat - 0.012, lng: E.lng - 0.012, relay: 0, attendants: ["Brian Opio", "Teddy Nalubega"], manager: "Sandra Kyomuhendo" },
] as const;

export async function seedBuyExtras(): Promise<void> {
  const s: DbStatement[] = [];

  // ---- Fuel (Gas) ---------------------------------------------------------------------------
  const prices: Array<[string, number]> = [["prod_petrol", 5_200], ["prod_diesel", 5_000], ["prod_vpower", 5_600], ["prod_oil_2t", 9_000], ["prod_oil_4t", 28_000]];
  for (const f of PRACTICE_FUEL) {
    const station = `prac_fs_${f.n}`;
    const outlet = `prac_fo_${f.n}`;
    s.push({ sql: "INSERT OR IGNORE INTO fuel_stations (id, brand_name, company_name, status) VALUES (?, ?, ?, 'active')", args: [station, f.brand, `${f.brand} Uganda (practice)`] });
    s.push({
      sql: `INSERT OR IGNORE INTO fuel_station_outlets (id, station_id, name, code, address, lat, lng, phone, active_pumps, status, relay_drop) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4, 'active', ?)`,
      args: [outlet, station, f.name, `PRAC-FS-${f.n}`, `${f.name}, Entebbe`, f.lat, f.lng, `00000040${f.n}`, f.relay],
    });
    for (const [product, price] of prices) s.push({ sql: "INSERT OR IGNORE INTO fuel_station_prices (outlet_id, product_id, price_per_unit) VALUES (?, ?, ?)", args: [outlet, product, price + f.n * 20] });
    f.attendants.forEach((name, i) => s.push({
      sql: `INSERT OR IGNORE INTO fuel_pump_attendants (id, outlet_id, attendant_code, full_name, phone, pump_lane, status, pin) VALUES (?, ?, ?, ?, ?, ?, 'on_duty', '1234')`,
      args: [`prac_fa_${f.n}_${i + 1}`, outlet, `ATT-PRAC-${f.n}${i + 1}`, name, `0000005${f.n}${i + 1}`, `Pump ${i + 1}`],
    }));
    s.push({
      sql: `INSERT OR IGNORE INTO fuel_station_managers (id, outlet_id, manager_code, full_name, phone, pin, role, status) VALUES (?, ?, ?, ?, ?, '1234', 'station_manager', 'active')`,
      args: [`prac_fm_${f.n}`, outlet, `MGR-PRAC-${f.n}`, f.manager, `0000006${f.n}`],
    });
    s.push({ sql: "INSERT OR IGNORE INTO fuel_station_payout_accounts (id, outlet_id, type, account_ref, account_name, network_or_bank, is_primary) VALUES (?, ?, 'momo', ?, ?, 'MTN', 1)", args: [`prac_fpa_${f.n}`, outlet, `07000000${f.n}0`, f.manager] });
  }
  // Fuel history: finished fill-ups by the practice riders, and one voucher waiting to be used.
  for (let i = 0; i < 9; i++) {
    const f = PRACTICE_FUEL[i % 3]!;
    const rider = `prac_rider_${(i % 6) + 1}`;
    const litres = 3 + (i % 4) * 0.75;
    const price = 5_200 + f.n * 20;
    const total = Math.round(litres * price);
    s.push({
      sql: `INSERT OR IGNORE INTO fuel_codes (id, code, rider_id, vehicle_plate, authorized_amount_ugx, fuel_product_id, outlet_id, status, expires_at, dispensed_at, created_at, environment)
            VALUES (?, ?, ?, ?, ?, 'prod_petrol', ?, 'dispensed', datetime('now', '+1 day'), ${pastDays(i + 1)}, ${pastDays(i + 1)}, 'sandbox')`,
      args: [`prac_fc_${i}`, `PBGAS-90${String(1000 + i)}`, rider, `UF${i}P 24${i}K`, total, `prac_fo_${f.n}`],
    });
    s.push({
      sql: `INSERT OR IGNORE INTO fuel_dispenses (id, code_id, outlet_id, attendant_id, rider_id, vehicle_plate, product_id, price_per_litre, litres_dispensed, total_ugx, pump_number, receipt_ref, environment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'prod_petrol', ?, ?, ?, ?, ?, 'sandbox', ${pastDays(i + 1)})`,
      args: [`prac_fd_${i}`, `prac_fc_${i}`, `prac_fo_${f.n}`, `prac_fa_${f.n}_${(i % 2) + 1}`, rider, `UF${i}P 24${i}K`, price, litres, total, (i % 4) + 1, `RCP-PRAC-${1000 + i}`],
    });
  }
  s.push({
    sql: `INSERT OR IGNORE INTO fuel_codes (id, code, rider_id, vehicle_plate, authorized_amount_ugx, fuel_product_id, outlet_id, status, expires_at, held, environment)
          VALUES ('prac_fc_open', 'PBGAS-905555', 'prac_rider_1', 'UFP 246P', 20000, 'prod_petrol', 'prac_fo_1', 'active', datetime('now', '+1 day'), 1, 'sandbox')`,
    args: [],
  });

  // ---- Relay: stops along the two routes, matatu operators, and the stations that take parcels ----
  const stops: Record<string, Array<[string, number, number, number | null]>> = {
    prac_rr_kampala: [["Abaita Ababiri", 0.0805, 32.4801, 1], ["Kajjansi", 0.2133, 32.5559, null], ["Busega", 0.3139, 32.5409, null]],
    prac_rr_masaka: [["Kisubi", 0.1114, 32.5257, null], ["Mpigi", 0.2269, 32.3138, null], ["Lukaya", 0.1546, 31.9532, null]],
  };
  for (const [route, list] of Object.entries(stops)) {
    list.forEach(([name, lat, lng, outlet], i) => s.push({
      sql: "INSERT OR IGNORE INTO relay_route_stages (id, route_id, seq, name, lat, lng, outlet_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      args: [`${route}_stage_${i + 1}`, route, i + 1, name, lat, lng, outlet ? `prac_fo_${outlet}` : null],
    }));
  }
  [["prac_rop_1", "Godfrey Ssentongo", "prac_rr_kampala", "UBS 410M"], ["prac_rop_2", "Isaac Kibirige", "prac_rr_masaka", "UBS 411M"]].forEach(([id, name, route, plate], i) => {
    s.push(user(id!, name!, `00000070${i + 1}`));
    s.push({ sql: "INSERT OR IGNORE INTO relay_operators (user_id, route_id, vehicle_plate, phone, status) VALUES (?, ?, ?, ?, 'approved')", args: [id!, route!, plate!, `00000070${i + 1}`] });
  });

  // ---- Pharmacy ---------------------------------------------------------------------------------
  for (const [store, licence] of [["pe_lakeview_pharmacy", "NDA/PH/ENT/0412"], ["pe_victoria_pharmacy", "NDA/PH/ENT/0873"]] as const) {
    s.push({ sql: "INSERT OR IGNORE INTO pharmacy_approvals (store_id, licence_number, status, approved_by) VALUES (?, ?, 'approved', 'practice')", args: [store, licence] });
  }
  const image = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='100%' height='100%' fill='#f7f3e8'/><text x='20' y='60' font-size='22' font-family='serif'>Dr. A. Mukasa</text><text x='20' y='110' font-size='16'>Rx: Amoxicillin 500mg x 15</text><text x='20' y='140' font-size='16'>Paracetamol 500mg x 20</text><text x='20' y='360' font-size='14'>Practice prescription</text></svg>")}`;
  const rx = [
    { n: 1, c: 0, status: "pending_review", pharm: "pe_lakeview_pharmacy", name: "Lakeview Pharmacy Entebbe", notes: "For my daughter, 6 years", quote: [] as unknown[], total: 0 },
    { n: 2, c: 1, status: "quoted", pharm: "pe_lakeview_pharmacy", name: "Lakeview Pharmacy Entebbe", notes: "Chest infection", quote: [{ name: "Amoxicillin 500mg x15", qty: 1, unitPrice: 12_000 }, { name: "Paracetamol 500mg x20", qty: 1, unitPrice: 3_000 }], total: 15_000 },
    { n: 3, c: 2, status: "accepted", pharm: "pe_victoria_pharmacy", name: "Victoria Mall Pharmacy", notes: "Repeat prescription", quote: [{ name: "Metformin 500mg x60", qty: 1, unitPrice: 18_000 }], total: 18_000 },
    { n: 4, c: 3, status: "rejected", pharm: "pe_victoria_pharmacy", name: "Victoria Mall Pharmacy", notes: "Photo unreadable", quote: [] as unknown[], total: 0 },
  ];
  for (const r of rx) {
    const c = PRACTICE_CUSTOMERS[r.c]!;
    s.push({
      sql: `INSERT OR IGNORE INTO pharmacy_prescriptions (id, customer_id, customer_name, customer_phone, pharmacy_id, pharmacy_name, prescription_image_url, patient_notes, patient_age, patient_gender, status,
                                                         pharmacist_notes, dosage_instructions, quoted_items, quoted_total_ugx, delivery_address, environment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sandbox', ${pastDays(r.n)})`,
      args: [`prac_rx_${r.n}`, c.id, c.name, c.phone, r.pharm, r.name, image, r.notes, 6 + r.n * 11, r.n % 2 ? "female" : "male", r.status,
        r.status === "rejected" ? "The photo is too blurry to read. Please upload a clearer one." : r.quote.length ? "Both items in stock." : null,
        r.quote.length ? "Take as directed on the pack." : null, JSON.stringify(r.quote), r.total, c.areaAddress],
    });
  }

  // ---- Live selling, store ads and Pro stores --------------------------------------------------
  s.push({
    sql: `INSERT OR IGNORE INTO store_live_sessions (id, store_id, title, status, stream_url, thumbnail_url, featured_product_ids, viewer_peak, likes_count, started_at)
          VALUES ('prac_live_1', 'pe_lakeside_mart', 'Fresh stock just in', 'live', '/demo-video/market.mp4', '/demo-video/market.jpg', '["pe_lm_1","pe_lm_2"]', 64, 212, datetime('now', '-25 minutes'))`,
    args: [],
  });
  s.push({
    sql: `INSERT OR IGNORE INTO store_live_sessions (id, store_id, title, status, replay_url, thumbnail_url, featured_product_ids, viewer_peak, likes_count, started_at, ended_at)
          VALUES ('prac_live_2', 'pe_lakeside_mart', 'Saturday market special (replay)', 'replay', '/demo-video/market.mp4', '/demo-video/market.jpg', '["pe_lm_3"]', 131, 480, datetime('now', '-2 days'), datetime('now', '-2 days', '+45 minutes'))`,
    args: [],
  });
  PRACTICE_CUSTOMERS.slice(0, 4).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_live_chats (id, session_id, user_id, user_name, message, is_merchant, created_at) VALUES (?, 'prac_live_1', ?, ?, ?, 0, datetime('now', ?))",
    args: [`prac_lc_${i}`, c.id, c.name.split(" ")[0]!, ["Is the tilapia fresh today?", "Can you deliver to Kitoro?", "How much for the 2kg rice?", "Love the new stock 🔥"][i]!, `-${20 - i * 4} minutes`],
  }));
  s.push({ sql: "INSERT OR IGNORE INTO store_live_chats (id, session_id, user_id, user_name, message, is_merchant) VALUES ('prac_lc_reply', 'prac_live_1', 'prac_mu_pe_lakeside_mart', 'Lakeside Fresh Mart', 'Yes, caught this morning. Delivery to Kitoro is UGX 3,000.', 1)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO store_ad_campaigns (id, store_id, product_id, platform, headline, budget_amount, status, target_audience, clicks_count) VALUES ('prac_ad_1', 'pe_lakeside_mart', 'pe_lm_1', 'whatsapp', 'Fresh groceries to your door in Entebbe', 30000, 'active', 'Entebbe households', 87)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO store_ad_campaigns (id, store_id, product_id, platform, headline, budget_amount, status, target_audience, clicks_count) VALUES ('prac_ad_2', 'pe_phones_hub', 'pe_ph_1', 'meta', 'Power banks that last all day', 50000, 'completed', 'Phone owners', 240)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO store_subscriptions (id, store_id, merchant_id, tier, amount_paid, billing_cycle, status, expires_at) VALUES ('prac_sub_1', 'pe_lakeside_mart', 'prac_m_pe_lakeside_mart', 'pro_live', 90000, 'monthly', 'active', datetime('now', '+20 days'))", args: [] });

  await runSeed(s);
}
