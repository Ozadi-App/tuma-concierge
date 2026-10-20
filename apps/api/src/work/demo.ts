import bcrypt from "bcryptjs";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { ensureAccountCode } from "../lib/profile-codes.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { workReady } from "./service.js";

/**
 * Demo accounts for Peebee Work, in Entebbe, so a whole job can be tested end to end in SANDBOX:
 * one customer with sandbox wallet money, and approved, online providers for laundry, cleaning and fixing
 * (two of them companies with a staff member). Everything has a fixed id, so installing again resets
 * them in place; they exist only in the sandbox and use sandbox money.
 */

type Row = Record<string, unknown>;

const EMAIL_SUFFIX = "@demo.peebee.invalid";
/** Entebbe town. Providers sit a few streets apart so "nearby" finds all of them. */
const ENTEBBE = { lat: 0.0512, lng: 32.4637 };
export const DEMO_WALLET_UGX = 2_000_000;

type DemoPerson = { id: string; name: string; phone: string; email: string };
type DemoProvider = {
  id: string;
  owner: DemoPerson;
  staff?: DemoPerson;
  kind: "individual" | "company";
  displayName: string;
  companyName?: string;
  bio: string;
  type: "clean" | "laundry" | "fix";
  dLat: number;
  dLng: number;
};

const person = (n: number, slug: string, name: string): DemoPerson => ({
  id: `wdemo_${slug}`, name, phone: `+25679001${String(n).padStart(4, "0")}`, email: `demo.${slug}${EMAIL_SUFFIX}`,
});

export const DEMO_CUSTOMER = person(1, "customer", "Demo Customer (Entebbe)");

export const DEMO_PROVIDERS: DemoProvider[] = [
  { id: "wpr_demo_laundry", owner: person(2, "laundry", "Lakeside Laundry Entebbe"), staff: person(3, "laundry_staff", "Lakeside Laundry - Attendant"), kind: "company", displayName: "Lakeside Laundry", companyName: "Lakeside Laundry Entebbe Ltd", bio: "Wash and fold, dry cleaning and bulky items, collected and returned in Entebbe.", type: "laundry", dLat: 0.004, dLng: -0.006 },
  { id: "wpr_demo_clean_co", owner: person(4, "clean_co", "Entebbe Sparkle Cleaners"), staff: person(5, "clean_co_staff", "Sparkle Cleaners - Cleaner"), kind: "company", displayName: "Entebbe Sparkle Cleaners", companyName: "Entebbe Sparkle Cleaners Ltd", bio: "Homes, offices, cars and upholstery across Entebbe and Kitoro.", type: "clean", dLat: -0.006, dLng: 0.005 },
  { id: "wpr_demo_clean_solo", owner: person(6, "clean_solo", "Grace Nakato"), kind: "individual", displayName: "Grace Nakato", bio: "Careful home cleaning, ten years' experience.", type: "clean", dLat: 0.008, dLng: 0.004 },
  { id: "wpr_demo_fix", owner: person(7, "fix", "Kato Fix-It"), kind: "individual", displayName: "Kato Fix-It", bio: "Plumbing, electrics and general repairs.", type: "fix", dLat: -0.003, dLng: -0.01 },
];

export const DEMO_ACCOUNTS: Array<DemoPerson & { role: string }> = [
  { ...DEMO_CUSTOMER, role: "Customer" },
  ...DEMO_PROVIDERS.flatMap((p) => [
    { ...p.owner, role: `${p.type === "clean" ? "Cleaning" : p.type === "laundry" ? "Laundry" : "Fix"} provider (${p.kind === "company" ? "company owner" : "individual"})` },
    ...(p.staff ? [{ ...p.staff, role: "Company staff" }] : []),
  ]),
];

export class WorkDemoError extends Error {
  constructor(public code: string, message: string, public status: 409 | 503 = 409) { super(message); }
}

async function userStatements(p: DemoPerson, hash: string, walletUgx: number): Promise<DbStatement[]> {
  return [
    {
      sql: `INSERT INTO users (id, phone, email, name, role, password_hash, phone_verified_at, email_verified_at, password_set_at, wallet_balance_sandbox)
            VALUES (?, ?, ?, ?, 'customer', ?, datetime('now'), datetime('now'), datetime('now'), ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, status = 'active', password_set_at = datetime('now'),
              wallet_balance_sandbox = excluded.wallet_balance_sandbox`,
      args: [p.id, p.phone, p.email, p.name, hash, walletUgx],
    },
  ];
}

export async function installWorkDemo(password: string): Promise<{ count: number }> {
  if (!(await workReady())) throw new WorkDemoError("upgrade_pending", "Peebee Work isn't set up yet: apply migrations 0098 to 0100 first.", 503);
  if ((await getPlatformEnvironment()) !== "sandbox") throw new WorkDemoError("not_sandbox", "Switch the platform to sandbox first. Demo accounts are sandbox only.");
  const clash = (await db.execute({
    sql: `SELECT phone FROM users WHERE phone IN (${DEMO_ACCOUNTS.map(() => "?").join(",")}) AND id NOT LIKE 'wdemo_%'`,
    args: DEMO_ACCOUNTS.map((a) => a.phone),
  })).rows as Row[];
  if (clash.length) throw new WorkDemoError("phone_in_use", "A real account already uses one of the demo phone numbers.");

  const hash = await bcrypt.hash(password, 10);
  const services = (await db.execute("SELECT id, type FROM work_services WHERE active = 1")).rows as Row[];
  const statements: DbStatement[] = [...(await userStatements(DEMO_CUSTOMER, hash, DEMO_WALLET_UGX))];

  for (const p of DEMO_PROVIDERS) {
    statements.push(...(await userStatements(p.owner, hash, 0)));
    if (p.staff) statements.push(...(await userStatements(p.staff, hash, 0)));
    statements.push(
      {
        sql: `INSERT INTO work_providers (id, user_id, kind, display_name, company_name, phone, bio, status, online, lat, lng, location_at, approved_by, approved_at, environment)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?, datetime('now'), 'demo', datetime('now'), 'sandbox')
              ON CONFLICT(id) DO UPDATE SET status = 'approved', online = 1, lat = excluded.lat, lng = excluded.lng, location_at = datetime('now'), environment = 'sandbox',
                display_name = excluded.display_name, company_name = excluded.company_name, bio = excluded.bio`,
        args: [p.id, p.owner.id, p.kind, p.displayName, p.companyName ?? null, p.owner.phone, p.bio, ENTEBBE.lat + p.dLat, ENTEBBE.lng + p.dLng],
      },
      { sql: "INSERT OR IGNORE INTO work_provider_members (provider_id, user_id, role) VALUES (?, ?, 'owner')", args: [p.id, p.owner.id] },
      { sql: "DELETE FROM work_provider_services WHERE provider_id = ?", args: [p.id] },
    );
    if (p.staff) statements.push({ sql: "INSERT OR IGNORE INTO work_provider_members (provider_id, user_id, role) VALUES (?, ?, 'staff')", args: [p.id, p.staff.id] });
    for (const s of services.filter((s) => s.type === p.type)) {
      statements.push({ sql: "INSERT OR IGNORE INTO work_provider_services (provider_id, service_id) VALUES (?, ?)", args: [p.id, String(s.id)] });
    }
  }
  await executeBatch(statements);
  for (const a of DEMO_ACCOUNTS) await ensureAccountCode(a.id);
  return { count: DEMO_ACCOUNTS.length };
}

export async function workDemoStatus(): Promise<{ installed: boolean; sandbox: boolean; accounts: Array<{ name: string; phone: string; email: string; role: string }> }> {
  const found = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM users WHERE id LIKE 'wdemo_%'", args: [] })).rows[0] as Row | undefined;
  return {
    installed: Number(found?.n ?? 0) > 0,
    sandbox: (await getPlatformEnvironment()) === "sandbox",
    accounts: DEMO_ACCOUNTS.map(({ name, phone, email, role }) => ({ name, phone, email, role })),
  };
}

/** Takes the demo providers offline and locks the accounts; deletes them outright when no job ever involved them. */
export async function removeWorkDemo(): Promise<{ deleted: number; locked: number }> {
  const ids = DEMO_ACCOUNTS.map((a) => a.id);
  const marks = ids.map(() => "?").join(",");
  await db.execute({ sql: `UPDATE work_providers SET online = 0, status = 'suspended', status_note = 'Demo account removed' WHERE id LIKE 'wpr_demo_%'`, args: [] });
  const used = new Set(
    ((await db.execute({
      sql: `SELECT DISTINCT customer_id AS u FROM work_jobs WHERE customer_id IN (${marks})
            UNION SELECT DISTINCT p.user_id FROM work_jobs j JOIN work_providers p ON p.id = j.provider_id WHERE p.id LIKE 'wpr_demo_%'
            UNION SELECT DISTINCT user_id FROM work_money WHERE user_id IN (${marks})`,
      args: [...ids, ...ids],
    })).rows as Row[]).map((r) => String(r.u)),
  );
  const hasJobs = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM work_jobs j JOIN work_providers p ON p.id = j.provider_id WHERE p.id LIKE 'wpr_demo_%'", args: [] })).rows[0] as Row;
  const anyJobs = used.size > 0 || Number(hasJobs.n) > 0;
  if (anyJobs) {
    await db.execute({ sql: `UPDATE users SET status = 'suspended', password_hash = '!locked-demo-account' WHERE id IN (${marks})`, args: ids });
    return { deleted: 0, locked: ids.length };
  }
  await executeBatch([
    { sql: "DELETE FROM work_provider_services WHERE provider_id LIKE 'wpr_demo_%'", args: [] },
    { sql: "DELETE FROM work_provider_members WHERE provider_id LIKE 'wpr_demo_%'", args: [] },
    { sql: "DELETE FROM work_providers WHERE id LIKE 'wpr_demo_%'", args: [] },
    { sql: `DELETE FROM users WHERE id IN (${marks})`, args: ids },
  ]);
  return { deleted: ids.length, locked: 0 };
}
