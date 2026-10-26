import { PRACTICE_ENTEBBE } from "@peebee/shared/practice-entebbe";
import { type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";

/**
 * The people behind the Partner, Sales and TV apps. Each is one persona that sees the whole app: the partner owns cars,
 * drives one, takes an approved shared taxi they can join the line with and runs a relay stop; the sales agent has a book of businesses they
 * signed up, some activated and some still waiting.
 */
const E = PRACTICE_ENTEBBE;
const NO_PASSWORD = "practice-account-no-password";
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString().replace("T", " ").slice(0, 19);

export const PRACTICE_PARTNER_ID = "prac_partner_1";
export const PRACTICE_SALES_ID = "prac_sales_1";

const user = (id: string, name: string, phone: string, walletUgx = 0): DbStatement => ({
  sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at, wallet_balance_sandbox)
        VALUES (?, ?, ?, ?, 'customer', 'active', datetime('now'), ?)`,
  args: [id, phone, name, NO_PASSWORD, walletUgx],
});

const SIGNED_UP = [
  { n: 1, type: "merchant", name: "Kisubi Fresh Foods", phone: "0000009101", activated: true, channel: "sms", delivery: "sent" },
  { n: 2, type: "restaurant", name: "Mama Rose Kitchen", phone: "0000009102", activated: true, channel: "whatsapp", delivery: "sent" },
  { n: 3, type: "rider", name: "Ivan Mubiru", phone: "0000009103", activated: false, channel: "sms", delivery: "sent" },
  { n: 4, type: "partner", name: "Entebbe Cab Link", phone: "0000009104", activated: false, channel: "email", delivery: "failed" },
  { n: 5, type: "gas", name: "Katabi Fuel Stop", phone: "0000009105", activated: true, channel: "sms", delivery: "sent" },
  { n: 6, type: "customer", name: "Dorothy Nabirye", phone: "0000009106", activated: false, channel: "sms", delivery: "unavailable" },
] as const;

export async function seedPartners(): Promise<void> {
  const s: DbStatement[] = [];

  // ---- The partner: owner, driver, shared-taxi driver and relay operator in one ----
  const me = PRACTICE_PARTNER_ID;
  s.push(user(me, "Moses Kiwanuka", "0000008001", 85_000));
  s.push({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status, reviewed_at) VALUES (?, 'approved', 'approved', datetime('now'))", args: [me] });
  s.push(user("prac_cdrv_93", "Jacob Lutalo", "0000008093"));
  s.push({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status, reviewed_at) VALUES ('prac_cdrv_93', 'none', 'approved', datetime('now'))", args: [] });
  const cars = [
    { id: "prac_veh_pp1", category: "peebee-car-normal", plate: "UBT 120M", make: "Toyota", model: "Premio", seats: 4, driver: me, d: [0.002, 0.003] },
    { id: "prac_veh_pp2", category: "peebee-car-large", plate: "UBT 121M", make: "Toyota", model: "Noah", seats: 7, driver: "prac_cdrv_93", d: [-0.004, 0.002] },
  ] as const;
  for (const v of cars) {
    s.push({
      sql: `INSERT OR IGNORE INTO vehicles (id, owner_id, category_id, plate, make, model, year, colour, status, reviewed_at, service_class, condition_grade, seat_capacity, features_json, accepts_convenient)
            VALUES (?, ?, ?, ?, ?, ?, 2019, 'Silver', 'approved', datetime('now'), 'comfort', 'excellent', ?, '["Air conditioning","Bluetooth"]', 1)`,
      args: [v.id, me, v.category, v.plate, v.make, v.model, v.seats],
    });
    s.push({ sql: "INSERT OR IGNORE INTO vehicle_assignments (id, vehicle_id, driver_id, status, assigned_by) VALUES (?, ?, ?, 'active', ?)", args: [`${v.id}_asg`, v.id, v.driver, me] });
    s.push({ sql: "INSERT OR REPLACE INTO car_driver_state (driver_id, vehicle_id, online, lat, lng) VALUES (?, ?, 1, ?, ?)", args: [v.driver, v.id, E.lat + v.d[0], E.lng + v.d[1]] });
  }
  // A car out for hire, listed with the owner's price.
  s.push({
    sql: `INSERT OR IGNORE INTO vehicles (id, owner_id, category_id, plate, make, model, year, colour, status, reviewed_at, service_class, condition_grade, seat_capacity, features_json, accepts_convenient)
          VALUES ('prac_rent_veh_pp3', ?, 'demo-rent-hatch-cat', 'UAX 399R', 'Suzuki', 'Swift', 2021, 'White', 'approved', datetime('now'), 'convenient', 'good', 5, '["Air conditioning"]', 1)`,
    args: [me],
  });
  s.push({
    sql: `INSERT OR IGNORE INTO rental_listings (vehicle_id, daily_price, deposit_amount, notes, active, hourly_enabled, half_day_enabled, full_day_enabled, environment)
          VALUES ('prac_rent_veh_pp3', 95000, 45000, 'Moses Kiwanuka · Entebbe pickup', 1, 1, 1, 1, 'sandbox')`,
    args: [],
  });
  s.push({
    sql: `INSERT OR IGNORE INTO carpool_trips (id, driver_id, vehicle_id, category_id, origin_label, origin_lat, origin_lng, dest_label, dest_lat, dest_lng, distance_km, depart_at, seats_total, seats_taken, seat_price, status, environment)
          VALUES ('prac_trip_pp1', ?, 'prac_veh_pp1', 'peebee-car-normal', 'Entebbe Town', 0.0612, 32.4637, 'Kampala (Garden City)', 0.3209, 32.5917, 38, ?, 3, 0, 12000, 'open', 'sandbox')`,
    args: [me, inHours(4)],
  });
  // An approved shared taxi (not in the line: a driver is either in the line or taking car rides, never both) and a relay stop on the Masaka road.
  s.push({
    sql: `INSERT OR IGNORE INTO taxipress_taxis (id, user_id, relay_route_id, plate, seat_layout, seats, status, approved_at) VALUES ('prac_taxi_pp', ?, 'prac_rr_kampala', 'UBR 190T', '14', 14, 'approved', datetime('now'))`,
    args: [me],
  });
  s.push({ sql: "INSERT OR IGNORE INTO relay_operators (user_id, route_id, vehicle_plate, phone, status) VALUES (?, 'prac_rr_masaka', 'UBS 412M', '0000008001', 'approved')", args: [me] });

  // ---- The sales agent and the businesses they signed up ----
  const agent = PRACTICE_SALES_ID;
  s.push(user(agent, "Racheal Namugga", "0000008002"));
  s.push({ sql: "INSERT OR IGNORE INTO sales_agents (user_id, enabled, created_by) VALUES (?, 1, ?)", args: [agent, agent] });
  for (const b of SIGNED_UP) {
    const uid = `prac_onb_user_${b.n}`;
    s.push(user(uid, b.name, b.phone));
    s.push({
      sql: `INSERT OR IGNORE INTO onboarding_accounts (id, user_id, agent_id, account_type, request_id, consent_at, preferred_channel, activated_at, last_invited_at, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ${b.activated ? "datetime('now', '-1 day')" : "NULL"}, datetime('now', ?), datetime('now', ?))`,
      args: [`prac_onb_${b.n}`, uid, agent, b.type, `prac-request-${b.n}`, b.channel, `-${b.n} days`, `-${b.n + 1} days`],
    });
    s.push({ sql: "INSERT OR IGNORE INTO onboarding_deliveries (id, account_id, channel, status) VALUES (?, ?, ?, ?)", args: [`prac_onb_del_${b.n}`, `prac_onb_${b.n}`, b.channel, b.delivery] });
  }

  await runSeed(s);
}
