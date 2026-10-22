import { db } from "../db/client.js";

/**
 * Whether a column exists in the live database. Migrations here are applied by
 * hand, not by the deploy, so new code can reach production before the
 * migration it depends on. Features that add a column use this to fall back to
 * their previous behaviour until it lands, instead of failing every request
 * that touches the table.
 *
 * "Yes" is remembered for the life of the isolate; "no" is re-checked after a
 * short while so the feature switches on soon after the migration is applied.
 */
const answers = new Map<string, { exists: boolean; at: number }>();
const NO_TTL_MS = 30_000;

export async function hasColumn(table: "edu_schools" | "edu_courses" | "edu_lessons" | "edu_live_sessions" | "tv_devices" | "fee_proposals" | "menu_items" | "list_items" | "users" | "riders" | "restaurants" | "merchants" | "merchant_outlets" | "order_applications" | "orders" | "car_bookings" | "ai_api_keys" | "car_partners" | "vehicle_assignments" | "rental_listings" | "rentals" | "vehicles" | "fuel_pump_attendants" | "fuel_codes" | "fuel_station_withdrawals" | "pharmacy_prescriptions" | "vehicle_categories" | "relay_routes" | "fuel_station_outlets" | "order_relay" | "ad_events" | "channels" | "users", column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const known = answers.get(key);
  if (known && (known.exists || Date.now() - known.at < NO_TTL_MS)) return known.exists;
  let exists = false;
  try {
    const res = await db.execute({ sql: `SELECT 1 FROM pragma_table_info('${table}') WHERE name = ?`, args: [column] });
    exists = res.rows.length > 0;
  } catch {
    exists = false;
  }
  answers.set(key, { exists, at: Date.now() });
  return exists;
}

/** Same idea for a whole table: code that reads a table added by a hand-applied migration. */
export async function hasTable(table: "guest_orders" | "guest_notifications" | "edu_educator_plans" | "edu_cohorts" | "edu_course_instructors" | "edu_reviews" | "edu_coupons" | "edu_assignments" | "edu_live_attendance" | "edu_certificates" | "order_stops" | "fare_offer_requests" | "stores" | "food_item_reviews" | "merchants" | "merchant_outlets" | "car_bookings" | "vehicle_categories" | "car_withdrawals" | "scheduled_checks" | "carpool_trips" | "rentals" | "rental_inspections" | "rental_inspection_photos" | "ledger_transactions" | "saved_passengers" | "vehicle_photos" | "ai_api_keys" | "ai_key_limits" | "car_partner_documents" | "driver_requests" | "email_api_keys" | "email_api_usage" | "onboarding_accounts" | "sales_agents" | "sales_agent_requests" | "selfdrive_renter_kyc" | "fuel_stations" | "fuel_station_outlets" | "fuel_products" | "fuel_station_prices" | "fuel_pump_attendants" | "fuel_codes" | "fuel_dispenses" | "fuel_attendant_shifts" | "fuel_station_managers" | "fuel_station_withdrawals" | "fuel_station_payout_accounts" | "pharmacy_prescriptions" | "pharmacy_prescription_events" | "pharmacy_approvals" | "car_partners" | "vehicles" | "relay_routes" | "relay_operators" | "order_relay_legs" | "order_relay" | "relay_route_stages" | "taxipress_routes" | "taxipress_taxis" | "taxipress_queue" | "taxipress_bookings" | "taxipress_settlements" | "taxipress_refunds" | "video_assets" | "video_credentials" | "ad_campaigns" | "ad_creatives" | "ad_events" | "channels" | "channel_follows" | "channel_tiers" | "channel_subscriptions" | "posts" | "post_reactions" | "post_comments" | "post_reports" | "post_poll_votes" | "post_unlocks" | "post_views" | "post_previews" | "creator_balances" | "creator_earnings" | "creator_kyc" | "creator_payout_accounts" | "creator_withdrawals" | "causes" | "cause_updates" | "donations" | "reward_rates" | "creator_points" | "reward_conversions"): Promise<boolean> {
  const key = `table.${table}`;
  const known = answers.get(key);
  if (known && (known.exists || Date.now() - known.at < NO_TTL_MS)) return known.exists;
  let exists = false;
  try {
    exists = await tableExistsCheap(table);
  } catch {
    exists = false;
  }
  answers.set(key, { exists, at: Date.now() });
  return exists;
}

/**
 * Does a table exist? Reads only that table's column list (about a dozen rows) through pragma_table_info.
 * Looking the name up in sqlite_master has no index and reads every row of the schema (500+ here), and D1 bills
 * every row read, so those probes alone were most of the daily read allowance. Not cached: callers cache the answer.
 */
export async function tableExistsCheap(name: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/i.test(name)) return false;
  const res = await db.execute({ sql: `SELECT 1 FROM pragma_table_info('${name}') LIMIT 1`, args: [] });
  return res.rows.length > 0;
}

/** True when every named table exists. For the "is this hand-applied migration in yet" readiness checks. */
export async function tablesExist(names: readonly string[]): Promise<boolean> {
  return (await Promise.all(names.map(tableExistsCheap))).every(Boolean);
}

/** For tests that swap databases. */
export function resetSchemaCache(): void {
  answers.clear();
}
