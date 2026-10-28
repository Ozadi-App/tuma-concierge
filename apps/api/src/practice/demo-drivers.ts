import { db } from "../db/client.js";
import { actAsWorker } from "./demo-workers.js";

/**
 * Demo car drivers work the rides practising customers ask for, through the real API signed in as that driver: they offer on
 * a ride, and once a customer has picked them (and paid) they drive it, and settle it at the end. The partner a person can
 * sign in as is left alone.
 *
 * A ride gets a short head start for that person: demo drivers only offer on rides that have already waited this long, so
 * a practising partner has time to see a request and take it themselves. Must run inside runInPractice.
 */
export const DEMO_DRIVER_PATIENCE_SECONDS = 120;
const PERSONA = "prac_partner_1";
const DEMO_DRIVER = "'prac\\_cdrv\\_%' ESCAPE '\\'";

export async function runDemoDriverAutopilot(limit = 12): Promise<number> {
  let steps = 0;
  const as = new Map<string, Awaited<ReturnType<typeof actAsWorker>>>();
  const call = async (driver: string, path: string, body?: unknown) => {
    if (!as.has(driver)) as.set(driver, await actAsWorker(driver));
    return as.get(driver)!("POST", path, body);
  };

  // Offer on rides that have waited long enough: up to two drivers each, whoever the platform says can take it.
  const drivers = (await db.execute({ sql: `SELECT driver_id FROM car_driver_state WHERE online = 1 AND driver_id LIKE ${DEMO_DRIVER} AND driver_id <> ? ORDER BY driver_id`, args: [PERSONA] })).rows.map((r) => String(r.driver_id));
  const waiting = await db.execute({
    sql: `SELECT o.id FROM orders o JOIN car_bookings b ON b.order_id = o.id
          WHERE b.status = 'requested' AND +o.rider_id IS NULL AND o.stage IN ('Create', 'Match') AND o.customer_id >= 'prac_cust_' AND o.customer_id < 'prac_cust' || char(96)
            AND o.created_at <= datetime('now', ?) AND NOT EXISTS (SELECT 1 FROM order_applications a WHERE a.order_id = o.id)
          ORDER BY o.created_at LIMIT ?`,
    args: [`-${DEMO_DRIVER_PATIENCE_SECONDS} seconds`, limit],
  });
  for (const ride of waiting.rows) {
    let offered = 0;
    for (const driver of drivers) {
      if (offered >= 2) break;
      try {
        const answer = await call(driver, `/car/orders/${String(ride.id)}/apply`, {});
        if (answer.status < 300) { offered++; steps++; }
      } catch (err) {
        console.error("Practice demo driver offer failed:", err);
      }
    }
  }

  // Drive the rides they have been picked for.
  const driving = await db.execute({
    sql: `SELECT o.id, o.stage, o.rider_id FROM orders o JOIN car_bookings b ON b.order_id = o.id
          WHERE o.rider_id LIKE ${DEMO_DRIVER} AND o.rider_id <> ? AND o.stage IN ('Shop', 'Handover') ORDER BY o.updated_at LIMIT ?`,
    args: [PERSONA, limit],
  });
  for (const ride of driving.rows) {
    const path = String(ride.stage) === "Shop" ? "deliver" : "settle";
    try {
      const answer = await call(String(ride.rider_id), `/orders/${String(ride.id)}/${path}`, path === "deliver" ? { etaMinutes: 10 } : {});
      if (answer.status < 300) steps++;
      else console.error(`Practice demo driver ${path} refused:`, answer.status, JSON.stringify(answer.body).slice(0, 200));
    } catch (err) {
      console.error(`Practice demo driver ${path} failed:`, err);
    }
  }
  return steps;
}
