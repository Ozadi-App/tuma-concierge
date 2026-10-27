import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { orderRoutes } from "../orders/routes.js";
import { relayRoutes } from "../relay/routes.js";
import { taxipressRoutes } from "./routes.js";
import { ticketCodeRoutes } from "./ticket-share.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
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

const KAMPALA = { lat: 0.3136, lng: 32.5811 };
const ENTEBBE = { lat: 0.0512, lng: 32.4637 };

test("taxipress: a ticket can be sent on, and its code shows the details", async () => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "taxipress-ticket-share-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  resetSchemaCache();
  try {
    const people = [["staff", "admin", "0700000001"], ["d1", "customer", "0700000002"], ["buyer", "customer", "0700000003"], ["friend", "customer", "0700000004"], ["stranger", "customer", "0700000005"]];
    for (const [id, role, phone] of people) {
      await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'hash', ?)", args: [id, phone, `${id} Person`, role] });
    }
    await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'staff'");
    const app = new Hono().route("/v1/taxipress-ticket", ticketCodeRoutes).route("/v1", orderRoutes).route("/v1", relayRoutes).route("/v1", taxipressRoutes);
    const tokens = Object.fromEntries(await Promise.all(people.map(async ([sub, role]) => [sub, await signToken({ sub, role } as never)] as const)));
    const call = (who: string, path: string, body?: object, method?: string) => app.request(`/v1/${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;

    const relay = await json<{ id: string }>(await call("staff", "admin/relay/routes", {
      name: "Kampala - Entebbe", stageAName: "Kampala Stage", stageALat: KAMPALA.lat, stageALng: KAMPALA.lng,
      stageBName: "Entebbe Stage", stageBLat: ENTEBBE.lat, stageBLng: ENTEBBE.lng, parcelFare: 5000,
    }));
    const route = await json<{ id: string }>(await call("staff", "admin/taxipress/routes", { relayRouteId: relay.id, direction: "a_to_b", farePerSeat: 5000, active: true }));
    assert.equal((await call("staff", "admin/taxipress/settings", { enabled: true }, "PUT")).status, 200);
    assert.equal((await call("d1", "taxipress/taxi/apply", { relayRouteId: relay.id, plate: "uaz 111a", seatLayout: "14" })).status, 201);
    const taxis = await json<{ taxis: Array<{ id: string }> }>(await call("staff", "admin/taxipress/taxis"));
    assert.equal((await call("staff", `admin/taxipress/taxis/${taxis.taxis[0]!.id}`, { status: "approved" })).status, 200);
    assert.equal((await call("d1", "taxipress/driver/join", { routeId: route.id, ...KAMPALA })).status, 201);
    const line = await json<{ line: Array<{ id: string }> }>(await call("buyer", `taxipress/routes/${route.id}/queue`));

    const bought = await json<{ booking: { id: string; ticketCode: string }; order: { id: string } }>(await call("buyer", "taxipress/bookings", { queueId: line.line[0]!.id, adults: 1, payment: "cash", forSomeoneElse: true, travellerName: "Grandma Rose", travellerPhone: "0700000004", emergencyPhone: "0700000009" }));
    const { id, ticketCode } = bought.booking;
    assert.equal((await call("buyer", `orders/${bought.order.id}/fund`, { paymentMethod: "cash" })).status, 200);

    // Before it is sent, the friend sees nothing; a stranger cannot send it.
    assert.equal((await json<{ bookings: unknown[] }>(await call("friend", "taxipress/bookings/mine"))).bookings.length, 1, "matched by the traveller's phone");
    assert.equal((await call("stranger", `taxipress/bookings/${id}/send`, { name: "Rose", phone: "0700000004" })).status, 404);
    assert.equal((await call("buyer", `taxipress/bookings/${id}/send`, { name: "R", phone: "x" })).status, 400);

    const sent = await json<{ ok: boolean; code: string; onPeebee: boolean }>(await call("buyer", `taxipress/bookings/${id}/send`, { name: "Rose Nakato", phone: "+256 700 000 004" }));
    assert.equal(sent.ok, true);
    assert.equal(sent.code, ticketCode);
    assert.equal(sent.onPeebee, true);

    const mine = await json<{ bookings: Array<{ id: string; sharedWithMe?: boolean; sentBy?: string | null }> }>(await call("friend", "taxipress/bookings/mine"));
    assert.equal(mine.bookings[0]?.id, id);
    assert.equal(mine.bookings[0]?.sharedWithMe, true);
    assert.equal(mine.bookings[0]?.sentBy, "buyer");
    assert.equal((await call("friend", `taxipress/bookings/${id}`)).status, 200);
    assert.equal((await call("stranger", `taxipress/bookings/${id}`)).status, 404);

    // The code opens the details with no sign-in, with or without the prefix, and never shows phones.
    for (const typed of [ticketCode, ticketCode.replace("TXP-", "").toLowerCase()]) {
      const res = await app.request(`/v1/taxipress-ticket/${encodeURIComponent(typed)}`);
      assert.equal(res.status, 200);
      const ticket = (await json<{ ticket: Record<string, unknown> }>(res)).ticket;
      assert.equal(ticket.code, ticketCode);
      assert.equal(ticket.travellerName, "Rose Nakato");
      assert.equal(ticket.bookedBy, "buyer");
      assert.equal((ticket.route as { toName: string }).toName, "Entebbe Stage");
      assert.equal((ticket.taxi as { plate: string }).plate.toUpperCase(), "UAZ 111A");
      assert.ok(!JSON.stringify(ticket).includes("0700000"), "no phone numbers in a public ticket");
    }
    assert.equal((await app.request("/v1/taxipress-ticket/TXP-ZZZZZZ")).status, 404);
    assert.equal((await app.request("/v1/taxipress-ticket/nope")).status, 404);

    // Staff can turn sharing off: the code stops working and sending is refused.
    assert.equal((await call("staff", "admin/taxipress/settings", { ticketSharingEnabled: false }, "PUT")).status, 200);
    assert.equal((await app.request(`/v1/taxipress-ticket/${ticketCode}`)).status, 404);
    assert.notEqual((await call("buyer", `taxipress/bookings/${id}/send`, { name: "Rose Nakato", phone: "0700000004" })).status, 200);
    assert.equal((await json<{ bookings: unknown[] }>(await call("friend", "taxipress/bookings/mine"))).bookings.length, 0);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
