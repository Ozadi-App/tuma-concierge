/**
 * Receipt verification for the QR on a receipt: anyone who scans it (or types the reference) can check that Peebee
 * really issued it and see what it was for. Only what the receipt itself shows, with the plate masked and no names;
 * the reference is the proof, so only an exact match answers.
 */
import { Hono } from "hono";
import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";

type Row = Record<string, unknown>;

export const publicReceiptRoutes = new Hono();

export type PublicReceipt = {
  valid: true;
  kind: "fuel" | "taxipress";
  title: string;
  /** What the receipt is, line by line, ready to show. */
  lines: Array<{ label: string; value: string }>;
  amountUgx: number;
  issuedAt: string;
  /** Issued in the sandbox, so it is practice money. */
  demo: boolean;
};

const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-UG")}`;
/** UBH 421K -> UB• ••1K: enough to recognise your own vehicle, not enough to identify someone else's. */
const maskPlate = (plate: string) => (plate.length <= 3 ? "•••" : `${"•".repeat(Math.max(0, plate.length - 2))}${plate.slice(-2)}`);

async function fuelReceipt(ref: string): Promise<PublicReceipt | null> {
  if (!(await hasTable("fuel_dispenses"))) return null;
  const row = (await db.execute({
    sql: `SELECT d.receipt_ref, d.created_at, d.litres_dispensed, d.price_per_litre, d.total_ugx, d.vehicle_plate, d.environment,
                 o.name AS outlet_name, s.brand_name AS station_name, p.name AS product_name
          FROM fuel_dispenses d
          JOIN fuel_station_outlets o ON o.id = d.outlet_id
          JOIN fuel_stations s ON s.id = o.station_id
          JOIN fuel_products p ON p.id = d.product_id
          WHERE d.receipt_ref = ? AND d.status = 'completed'`,
    args: [ref],
  })).rows[0] as Row | undefined;
  if (!row) return null;
  return {
    valid: true, kind: "fuel", title: "Fuel receipt",
    lines: [
      { label: "Reference", value: String(row.receipt_ref) },
      { label: "Station", value: `${row.station_name} · ${row.outlet_name}` },
      { label: "Fuel", value: String(row.product_name) },
      { label: "Litres", value: Number(row.litres_dispensed).toFixed(2) },
      { label: "Price per litre", value: ugx(Number(row.price_per_litre)) },
      { label: "Vehicle", value: maskPlate(String(row.vehicle_plate)) },
    ],
    amountUgx: Number(row.total_ugx), issuedAt: String(row.created_at), demo: row.environment === "sandbox",
  };
}

async function taxipressReceipt(ref: string): Promise<PublicReceipt | null> {
  if (!(await hasTable("taxipress_settlements"))) return null;
  const row = (await db.execute({
    sql: `SELECT s.id, s.seats, s.fare, s.payment_method, s.environment, s.created_at, t.direction, rr.stage_a_name, rr.stage_b_name
          FROM taxipress_settlements s
          JOIN taxipress_queue q ON q.id = s.queue_id
          JOIN taxipress_routes t ON t.id = q.taxipress_route_id
          JOIN relay_routes rr ON rr.id = t.relay_route_id
          WHERE s.id = ?`,
    args: [ref],
  })).rows[0] as Row | undefined;
  if (!row) return null;
  const forward = row.direction === "a_to_b";
  return {
    valid: true, kind: "taxipress", title: "Taxipress receipt",
    lines: [
      { label: "Reference", value: String(row.id) },
      { label: "Trip", value: `${forward ? row.stage_a_name : row.stage_b_name} → ${forward ? row.stage_b_name : row.stage_a_name}` },
      { label: "Seats", value: String(row.seats) },
      { label: "Paid", value: row.payment_method === "cash" ? "In cash to the driver" : "In the app" },
    ],
    amountUgx: Number(row.fare), issuedAt: String(row.created_at), demo: row.environment === "sandbox",
  };
}

publicReceiptRoutes.get("/public/receipts/:ref", async (c) => {
  const ref = decodeURIComponent(c.req.param("ref")).trim();
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(ref)) return c.json({ valid: false, error: "not_found", message: "That isn't a Peebee receipt reference." }, 404);
  const receipt = ref.toUpperCase().startsWith("RCP-GAS-") ? await fuelReceipt(ref.toUpperCase()) : ref.startsWith("tps_") ? await taxipressReceipt(ref) : null;
  if (!receipt) return c.json({ valid: false, error: "not_found", message: "No Peebee receipt has this reference." }, 404);
  c.header("Cache-Control", "no-store");
  return c.json(receipt);
});
