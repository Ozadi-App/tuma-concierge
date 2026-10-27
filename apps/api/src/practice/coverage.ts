import { MODULES } from "@peebee/shared";
import { db } from "../db/client.js";

const P = "'prac\\_%' ESCAPE '\\'";
const like = (column: string, prefix: string) => `${column} LIKE '${prefix.replace(/_/g, "\\_")}%' ESCAPE '\\'`;
const demoCustomer = `customer_id LIKE ${P}`;

/**
 * One count per module of the demo rows that make it playable. These are what Admin → Practice shows, and a test fails
 * if any module comes back empty, so "fully covered" is something the code checks rather than something it claims.
 */
export const MODULE_PROBES: Record<string, string> = {
  ride: `SELECT COUNT(*) FROM orders WHERE is_ride = 1 AND ${demoCustomer}`,
  "ride.boda": `SELECT COUNT(*) FROM orders o WHERE o.is_ride = 1 AND o.${demoCustomer} AND NOT EXISTS (SELECT 1 FROM car_bookings b WHERE b.order_id = o.id)`,
  "ride.for_other": `SELECT COUNT(*) FROM orders WHERE passenger_name IS NOT NULL AND ${demoCustomer}`,
  "ride.bidding": `SELECT COUNT(*) FROM orders WHERE fare_offer IS NOT NULL AND ${demoCustomer}`,
  "ride.car": `SELECT COUNT(*) FROM car_driver_state s JOIN vehicles v ON v.id = s.vehicle_id JOIN vehicle_categories c ON c.id = v.category_id WHERE ${like("s.driver_id", "prac_")} AND v.status = 'approved' AND c.service_group = 'standard' AND c.kind = 'passenger'`,
  "ride.car.ondemand": `SELECT COUNT(*) FROM car_bookings WHERE scheduled_for IS NULL AND ${demoCustomer} AND environment = 'sandbox'`,
  "ride.car.scheduled": `SELECT COUNT(*) FROM car_bookings WHERE scheduled_for IS NOT NULL AND ${demoCustomer}`,
  "ride.car.carpool": `SELECT COUNT(*) FROM carpool_trips WHERE ${like("id", "prac_")}`,
  "ride.car.selfdrive": `SELECT COUNT(*) FROM rental_listings WHERE ${like("vehicle_id", "prac_")} AND environment = 'sandbox'`,
  "ride.car.deals": `SELECT COUNT(*) FROM driver_requests WHERE ${like("id", "prac_")}`,
  "ride.luxury": `SELECT COUNT(*) FROM vehicles v JOIN vehicle_categories c ON c.id = v.category_id WHERE ${like("v.id", "prac_")} AND c.service_group = 'luxury'`,
  "ride.ambulance": `SELECT COUNT(*) FROM vehicles v JOIN vehicle_categories c ON c.id = v.category_id WHERE ${like("v.id", "prac_")} AND c.service_group = 'ambulance'`,
  "ride.move": `SELECT COUNT(*) FROM vehicles v JOIN vehicle_categories c ON c.id = v.category_id WHERE ${like("v.id", "prac_")} AND c.kind = 'cargo'`,
  "ride.taxipress": `SELECT COUNT(*) FROM taxipress_queue WHERE ${like("id", "prac_")}`,
  "ride.taxipress.luggage": `SELECT COUNT(*) FROM taxipress_bookings WHERE luggage_json IS NOT NULL AND luggage_json <> '{}' AND ${like("passenger_id", "prac_")}`,
  "ride.taxipress.assistance": `SELECT COUNT(*) FROM taxipress_bookings WHERE assistance IS NOT NULL AND assistance <> 'none' AND ${like("passenger_id", "prac_")}`,
  "ride.taxipress.language": `SELECT COUNT(*) FROM taxipress_bookings WHERE language IS NOT NULL AND ${like("passenger_id", "prac_")}`,
  "ride.taxipress.others": `SELECT COUNT(*) FROM taxipress_bookings WHERE for_someone_else = 1 AND ${like("passenger_id", "prac_")}`,

  deliver: `SELECT COUNT(*) FROM orders WHERE type = 'parcel' AND is_ride = 0 AND ${demoCustomer}`,
  "deliver.parcel": `SELECT COUNT(*) FROM orders WHERE type = 'parcel' AND is_ride = 0 AND ${demoCustomer}`,
  "deliver.relay": `SELECT (SELECT COUNT(*) FROM relay_route_stages WHERE ${like("route_id", "prac_")}) + (SELECT COUNT(*) FROM relay_operators WHERE ${like("user_id", "prac_")})`,

  buy: `SELECT COUNT(*) FROM stores WHERE ${like("merchant_id", "prac_")}`,
  "buy.shopping": `SELECT COUNT(*) FROM orders WHERE type = 'shopping' AND restaurant_id IS NULL AND ${demoCustomer}`,
  "buy.food": `SELECT COUNT(*) FROM menu_items WHERE ${like("restaurant_id", "prac_")}`,
  "buy.marketplace": `SELECT COUNT(*) FROM store_products WHERE store_id IN (SELECT id FROM stores WHERE ${like("merchant_id", "prac_")})`,
  "buy.marketplace.elite": `SELECT COUNT(*) FROM store_collections WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.b2b": `SELECT COUNT(*) FROM store_draft_orders WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.multi_outlet": `SELECT COUNT(*) FROM store_outlet_inventory WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.domain": `SELECT COUNT(*) FROM stores WHERE ${like("merchant_id", "prac_")} AND pro_tier = 'pro_live'`,
  "buy.marketplace.elite.loyalty": `SELECT COUNT(*) FROM store_customer_loyalty WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.pos": `SELECT COUNT(*) FROM store_pos_sales WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.transfers": `SELECT COUNT(*) FROM store_stock_transfers WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.crm": `SELECT COUNT(*) FROM store_customer_loyalty WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.purchase_orders": `SELECT COUNT(*) FROM store_purchase_orders WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.bundles": `SELECT COUNT(*) FROM store_bundles WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.winback": `SELECT COUNT(*) FROM store_winback_campaigns WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.sections": `SELECT COUNT(*) FROM store_collections WHERE ${like("id", "prac_")} AND pinned = 1`,
  "buy.marketplace.elite.sms": `SELECT COUNT(*) FROM store_sms_logs WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.digital": `SELECT COUNT(*) FROM store_digital_products WHERE ${like("id", "prac_")}`,
  "buy.marketplace.elite.lms": `SELECT COUNT(*) FROM store_lms_enrollments WHERE ${like("id", "prac_")}`,
  "buy.marketplace.live": `SELECT COUNT(*) FROM store_live_sessions WHERE ${like("id", "prac_")}`,
  "buy.pharmacy": `SELECT COUNT(*) FROM pharmacy_prescriptions WHERE ${like("id", "prac_")}`,
  "buy.gas": `SELECT COUNT(*) FROM fuel_dispenses WHERE ${like("id", "prac_")}`,
  "buy.guest": `SELECT COUNT(*) FROM guest_orders`,

  learn: `SELECT COUNT(*) FROM edu_courses WHERE ${like("id", "crs_demo_")}`,
  "learn.masterclasses": `SELECT COUNT(*) FROM edu_classes WHERE kind = 'masterclass'`,
  "learn.paid_courses": `SELECT COUNT(*) FROM edu_courses WHERE price_ugx > 0 AND ${like("id", "prac_")}`,
  "learn.live": `SELECT COUNT(*) FROM edu_live_members WHERE ${like("user_id", "prac_")}`,
  "learn.tv": `SELECT COUNT(*) FROM tv_devices WHERE ${like("id", "prac_")}`,
  "learn.certificates": `SELECT COUNT(*) FROM edu_certificates WHERE ${like("user_id", "prac_")}`,
  "learn.assignments": `SELECT COUNT(*) FROM edu_submissions WHERE ${like("user_id", "prac_")}`,
  "learn.reviews": `SELECT COUNT(*) FROM edu_reviews WHERE ${like("user_id", "prac_")}`,
  "learn.subscriptions": `SELECT COUNT(*) FROM edu_subscriptions WHERE ${like("user_id", "prac_")}`,
  "learn.enrolments": `SELECT COUNT(*) FROM edu_enrollments WHERE ${like("user_id", "prac_")}`,
  "learn.uploads": `SELECT COUNT(*) FROM edu_lessons WHERE ${like("course_id", "crs_demo_")} AND content_type IN ('video', 'audio')`,
  "learn.fees": `SELECT COUNT(*) FROM edu_fee_invoices WHERE ${like("id", "prac_")}`,
  "learn.live_lessons": `SELECT COUNT(*) FROM edu_live_sessions WHERE ${like("id", "liv_demo_")}`,
  "learn.trial_classes": `SELECT COUNT(*) FROM edu_live_sessions WHERE ${like("id", "liv_demo_")} AND status = 'live'`,
  "learn.badges": `SELECT COUNT(*) FROM edu_badges WHERE ${like("user_id", "prac_")}`,
  "learn.drip": `SELECT COUNT(*) FROM edu_module_drip WHERE ${like("module_id", "prac_")}`,
  "learn.prerequisites": `SELECT COUNT(*) FROM edu_course_rules WHERE prerequisite_course_id IS NOT NULL`,
  "learn.coupons": `SELECT COUNT(*) FROM edu_coupons WHERE ${like("id", "prac_")}`,
  "learn.bundles": `SELECT COUNT(*) FROM edu_bundles WHERE ${like("id", "prac_")}`,
  "learn.qa": `SELECT COUNT(*) FROM edu_questions WHERE ${like("id", "prac_")}`,
  "learn.announcements": `SELECT COUNT(*) FROM edu_announcements WHERE ${like("id", "prac_")}`,
  "learn.cohorts": `SELECT COUNT(*) FROM edu_cohorts WHERE ${like("id", "prac_")}`,
  "learn.instructors": `SELECT COUNT(*) FROM edu_course_instructors`,

  hive: `SELECT (SELECT COUNT(*) FROM work_providers WHERE ${like("id", "wpr_demo_")}) + (SELECT COUNT(*) FROM talent_profiles WHERE ${like("user_id", "talent_demo_")})`,
  "hive.work": `SELECT COUNT(*) FROM work_jobs WHERE ${like("id", "prac_")}`,
  "hive.work.chat": `SELECT COUNT(*) FROM work_messages WHERE ${like("id", "prac_")}`,
  "hive.work.tracking": `SELECT COUNT(*) FROM work_job_locations WHERE ${like("job_id", "prac_")}`,
  "hive.work.photos": `SELECT COUNT(*) FROM work_job_photos WHERE ${like("id", "prac_")}`,
  "hive.work.tomorrow": `SELECT COUNT(*) FROM work_jobs WHERE scheduled_for IS NOT NULL AND ${like("id", "prac_")}`,
  "hive.work.onsite": `SELECT COUNT(*) FROM work_flags WHERE ${like("id", "prac_")}`,
  "hive.hire": `SELECT COUNT(*) FROM talent_jobs WHERE environment = 'sandbox'`,
  "hive.hire.gigs": `SELECT COUNT(*) FROM talent_jobs WHERE type = 'gig' AND environment = 'sandbox'`,
  "hive.hire.projects": `SELECT COUNT(*) FROM talent_jobs WHERE type = 'project' AND environment = 'sandbox'`,
  "hive.hire.hiring": `SELECT COUNT(*) FROM talent_jobs WHERE type = 'hiring' AND environment = 'sandbox'`,
  "hive.hire.search": `SELECT COUNT(*) FROM talent_profiles WHERE environment = 'sandbox'`,
  "hive.hire.reviews": `SELECT COUNT(*) FROM talent_reviews WHERE ${like("id", "prac_")}`,
  "hive.hire.chat": `SELECT COUNT(*) FROM talent_messages WHERE ${like("id", "prac_")}`,
  "hive.hire.recurring": `SELECT COUNT(*) FROM talent_recurrences WHERE environment = 'sandbox'`,

  money: `SELECT COUNT(*) FROM wallet_topups WHERE ${like("user_id", "prac_")}`,
  "money.pro": `SELECT COUNT(*) FROM riders WHERE ${like("user_id", "prac_")} AND pro_status = 'active'`,
  "money.luganda_audio": `SELECT COUNT(*) FROM orders WHERE list_audio_key IS NOT NULL AND ${demoCustomer}`,
};

/** How many demo rows each module has right now. Run inside runInPractice. */
export async function moduleCoverage(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of MODULES) {
    const sql = MODULE_PROBES[m.key];
    if (!sql) { out[m.key] = 0; continue; }
    try {
      out[m.key] = Number(Object.values((await db.execute(sql)).rows[0] ?? { n: 0 })[0] ?? 0);
    } catch {
      out[m.key] = 0;
    }
  }
  return out;
}
