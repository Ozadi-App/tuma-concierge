import { db } from "../db/client.js";
import { inPractice } from "../db/practice-context.js";
import { getSetting } from "../lib/settings.js";
import { hasColumn } from "../lib/schema.js";

/**
 * Demo people share the users and riders tables with real ones; their ids say which they are. `prac_` is the practice
 * world's own people; the others are the older sandbox demos (Work, Hire, Learn, the Car and Relay drivers).
 *
 * An account made through normal sign-up has a plain id, so it can also be marked `users.is_demo = 1`
 * (migration 0149). A marked account is a demo person in every rule below: left out of the live platform, available
 * in the sandbox and in practice. The marks are read by `primeDemoAccounts` and kept for a few seconds; until the
 * migration is applied, or if the read fails, nothing is marked and the rules are exactly the id-prefix rules.
 */
const DEMO_ID_PREFIXES = ["prac_", "wdemo_", "talent_demo_", "usr_demo_", "demo-car-driver-", "demo-relay-"] as const;

const like = (prefix: string): string => `'${prefix.replace(/[_%\\]/g, (c) => `\\${c}`)}%' ESCAPE '\\'`;

/** The pattern for the practice world's own people. */
export const PRACTICE_ID_LIKE = "prac\\_%";

// Marked accounts and the platform switch, as last read. Both are properties of the whole deployment (not of one
// request), so sharing them between requests in an isolate is safe.
const TTL_MS = 15_000;
const MAX_MARKED = 500;
let markedIds: ReadonlySet<string> = new Set();
let platformIsSandbox = false;
let loadedAt = 0;

/** Sets what `primeDemoAccounts` reads. Exported for tests. */
export function applyDemoAccounts(ids: Iterable<string>, sandbox: boolean): void {
  markedIds = new Set(Array.from(ids).slice(0, MAX_MARKED));
  platformIsSandbox = sandbox;
}

/**
 * Reads the accounts marked as demo and whether the platform is in sandbox. Call it before building SQL with the
 * helpers below (the request pipeline does; so do the matchers that also run outside a request). Cheap when the last
 * read is recent. It never throws: on a failure the previous marks stay, and before any read nothing is marked.
 */
export async function primeDemoAccounts(): Promise<void> {
  if (Date.now() - loadedAt < TTL_MS) return;
  loadedAt = Date.now();
  try {
    const sandbox = (await getSetting("platform_environment")) === "sandbox";
    const ids = (await hasColumn("users", "is_demo"))
      ? ((await db.execute(`SELECT id FROM users WHERE is_demo = 1 LIMIT ${MAX_MARKED}`)).rows as Array<Record<string, unknown>>).map((r) => String(r.id))
      : [];
    applyDemoAccounts(ids, sandbox);
  } catch (err) {
    console.error("Could not read the demo accounts:", err);
  }
}

export const isPracticeUserId = (id: string): boolean => id.startsWith("prac_");
export const isDemoUserId = (id: string): boolean => DEMO_ID_PREFIXES.some((p) => id.startsWith(p)) || markedIds.has(id);

const quote = (id: string): string => `'${id.replace(/'/g, "''")}'`;
const markedList = (): string => Array.from(markedIds, quote).join(", ");

/** SQL: not one of the prefixed demo people (marked accounts are not considered here). */
const notPrefixedDemo = (column: string): string => DEMO_ID_PREFIXES.map((p) => `${column} NOT LIKE ${like(p)}`).join(" AND ");

/** SQL: only real people. For admin lists, counts and anything that reports on the live business. */
export const realPeopleOnly = (column: string): string =>
  markedIds.size ? `${notPrefixedDemo(column)} AND ${column} NOT IN (${markedList()})` : notPrefixedDemo(column);

/** SQL: demo people only. */
export const demoPeopleOnly = (column: string): string =>
  `(${DEMO_ID_PREFIXES.map((p) => `${column} LIKE ${like(p)}`).join(" OR ")}${markedIds.size ? ` OR ${column} IN (${markedList()})` : ""})`;

/**
 * SQL: the riders who may be offered or notified about the request in hand. Inside practice that is the practice
 * world's riders and the accounts marked as demo, so a real rider is never pinged about a practice order. In the live
 * platform it is every rider except the demo ones. In the sandbox it is every rider except the prefixed demo ones, so
 * a marked test account takes sandbox work.
 */
export const ridersForThisWorld = (column: string): string =>
  inPractice()
    ? `(${column} LIKE ${like("prac_")}${markedIds.size ? ` OR ${column} IN (${markedList()})` : ""})`
    : platformIsSandbox
      ? notPrefixedDemo(column)
      : realPeopleOnly(column);

/** SQL for an admin list: demo people show only while the admin is looking at the sandbox. */
export const demoPeopleFilter = (viewing: "live" | "sandbox", column: string): string => (viewing === "live" ? realPeopleOnly(column) : "1 = 1");

/**
 * SQL for shared fleet and configuration rows that carry no environment of their own (vehicles, taxi routes, fuel
 * stations, relay routes). Real rows show in the live platform; demo rows show in the sandbox and in practice.
 */
export const visibleInWorld = (viewing: "live" | "sandbox", column: string): string =>
  inPractice() ? demoPeopleOnly(column) : viewing === "live" ? realPeopleOnly(column) : "1 = 1";

/** The same rule as `visibleInWorld`, for ids already in hand. */
export const visibleHere = (viewing: "live" | "sandbox", id: string): boolean =>
  inPractice() ? isDemoUserId(id) : viewing === "live" ? !isDemoUserId(id) : true;
