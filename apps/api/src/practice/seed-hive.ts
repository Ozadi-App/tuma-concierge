import { db, type DbStatement } from "../db/client.js";
import { getR2Bucket } from "../storage/r2.js";
import { seedSandboxDemo } from "../talent/seed.js";
import { installWorkDemo } from "../work/demo.js";
import { runSeed } from "./batch.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/**
 * The Hive cluster. Work: the existing demo providers (laundry, cleaning, fixing, two of them companies) plus a history
 * of jobs in every state with offers, photos, chat, live location, money, ratings and an on-site check. Hire: the
 * existing sample workers, employers and jobs plus applications, hires, contracts with milestones, messages, ratings,
 * repeat jobs, memberships and money.
 */
type Row = Record<string, unknown>;
const when = (offset: string) => `datetime('now', '${offset}')`;
const ENTEBBE = { lat: 0.0512, lng: 32.4637 };

/** A tiny picture for a job photo, so the photo screens have something to show once a file store exists. */
const photoSvg = (label: string, colour: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="${colour}"/><text x="50%" y="52%" font-size="26" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;

export async function seedHive(): Promise<void> {
  // ---- Work ----------------------------------------------------------------------------------
  await installWorkDemo(crypto.randomUUID());
  const providers = (await db.execute("SELECT id, user_id, display_name, kind FROM work_providers WHERE id LIKE 'wpr\\_demo\\_%' ESCAPE '\\' ORDER BY id")).rows as Row[];
  const services = (await db.execute("SELECT id, type, name, pricing_mode, unit_price_ugx, callout_fee_ugx FROM work_services WHERE active = 1")).rows as Row[];
  const s: DbStatement[] = [];
  const pick = (type: string, pricing: string) => services.find((v) => v.type === type && v.pricing_mode === pricing) ?? services.find((v) => v.type === type)!;
  const providerFor = (type: string) => providers.find((p) => String(p.id).includes(type)) ?? providers[0]!;

  type Job = { n: number; customer: number; type: "clean" | "laundry" | "fix"; pricing: "fixed" | "quote"; status: string; ago: string; rating?: number; review?: string };
  const jobs: Job[] = [
    { n: 1, customer: 0, type: "clean", pricing: "fixed", status: "settled", ago: "-9 days", rating: 5, review: "Spotless, and on time." },
    { n: 2, customer: 1, type: "laundry", pricing: "fixed", status: "settled", ago: "-6 days", rating: 4, review: "Good wash, a little late." },
    { n: 3, customer: 2, type: "fix", pricing: "quote", status: "settled", ago: "-4 days", rating: 5, review: "Fixed the tap and explained everything." },
    { n: 4, customer: 3, type: "clean", pricing: "fixed", status: "in_progress", ago: "-40 minutes" },
    { n: 5, customer: 4, type: "laundry", pricing: "fixed", status: "booked", ago: "-2 hours" },
    { n: 6, customer: 5, type: "fix", pricing: "quote", status: "quoted", ago: "-3 hours" },
    { n: 7, customer: 0, type: "clean", pricing: "fixed", status: "open", ago: "-10 minutes" },
    { n: 8, customer: 1, type: "fix", pricing: "fixed", status: "disputed", ago: "-3 days" },
    { n: 9, customer: 2, type: "laundry", pricing: "fixed", status: "cancelled", ago: "-5 days" },
  ];
  for (const j of jobs) {
    const customer = PRACTICE_CUSTOMERS[j.customer]!;
    const service = pick(j.type, j.pricing);
    const provider = providerFor(j.type);
    const price = j.pricing === "quote" ? 55_000 : Number(service.unit_price_ugx) || 40_000;
    const assigned = !["open", "cancelled"].includes(j.status);
    const id = `prac_wj_${j.n}`;
    s.push({
      sql: `INSERT OR IGNORE INTO work_jobs (id, customer_id, service_id, service_type, service_name, pricing_mode, matching_mode, status, quantity, details, address, area, lat, lng, scheduled_for,
                                              unit_price_ugx, callout_fee_ugx, price_ugx, held_ugx, commission_percent, commission_ugx, provider_id, assigned_at, started_at, completed_at,
                                              settled_at, cancelled_at, cancelled_by, cancel_reason, rating, review, dispute_reason, environment, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'broadcast', ?, 1, ?, ?, ?, ?, ?, ${j.status === "booked" ? when("+1 days") : "NULL"}, ?, ?, ?, ?, 10, ?, ?, ${assigned ? when(j.ago) : "NULL"},
                    ${["in_progress", "settled", "disputed"].includes(j.status) ? when(j.ago) : "NULL"}, ${["settled", "disputed"].includes(j.status) ? when(j.ago) : "NULL"},
                    ${j.status === "settled" ? when(j.ago) : "NULL"}, ${j.status === "cancelled" ? when(j.ago) : "NULL"}, ?, ?, ?, ?, ?, 'sandbox', ${when(j.ago)}, ${when(j.ago)})`,
      args: [id, customer.id, String(service.id), j.type, String(service.name), j.pricing, j.status, "Please bring your own supplies.", customer.areaAddress, customer.areaAddress.split(",")[0],
        customer.lat, customer.lng, Number(service.unit_price_ugx) || 0, Number(service.callout_fee_ugx) || 0, price, ["booked", "in_progress"].includes(j.status) ? price : 0, Math.round(price * 0.1),
        assigned ? String(provider.id) : null, j.status === "cancelled" ? "customer" : null, j.status === "cancelled" ? "Changed plans" : null, j.rating ?? null, j.review ?? null,
        j.status === "disputed" ? "The tap still leaks after the repair." : null],
    });
    s.push({ sql: "INSERT OR IGNORE INTO work_events (id, job_id, actor_id, actor_kind, action, detail) VALUES (?, ?, ?, 'customer', 'created', 'Job created')", args: [`prac_we_${j.n}_1`, id, customer.id] });
    if (assigned) s.push({ sql: "INSERT OR IGNORE INTO work_events (id, job_id, actor_id, actor_kind, action, detail) VALUES (?, ?, ?, 'provider', 'accepted', 'Provider accepted')", args: [`prac_we_${j.n}_2`, id, String(provider.user_id)] });
    if (["settled", "in_progress", "booked", "disputed"].includes(j.status)) {
      s.push({ sql: "INSERT OR IGNORE INTO work_money (id, job_id, user_id, kind, amount_ugx, status, environment) VALUES (?, ?, ?, 'hold', ?, 'done', 'sandbox')", args: [`prac_wm_${j.n}_h`, id, customer.id, price] });
    }
    if (j.status === "settled") s.push({ sql: "INSERT OR IGNORE INTO work_money (id, job_id, user_id, kind, amount_ugx, status, environment, done_at) VALUES (?, ?, ?, 'payout', ?, 'done', 'sandbox', " + when(j.ago) + ")", args: [`prac_wm_${j.n}_p`, id, String(provider.user_id), Math.round(price * 0.9)] });
    if (assigned) {
      s.push({ sql: "INSERT OR IGNORE INTO work_messages (id, job_id, sender_id, sender_kind, body, created_at) VALUES (?, ?, ?, 'customer', 'Hello, is the time still okay?', " + when(j.ago) + ")", args: [`prac_wmsg_${j.n}_1`, id, customer.id] });
      s.push({ sql: "INSERT OR IGNORE INTO work_messages (id, job_id, sender_id, sender_kind, body, created_at) VALUES (?, ?, ?, 'provider', 'Yes, I am on my way.', " + when(j.ago) + ")", args: [`prac_wmsg_${j.n}_2`, id, String(provider.user_id)] });
    }
  }
  // An open job with offers from two providers; a job in progress with live location, photos and an arrival check; a flagged cancellation.
  for (const [i, p] of providers.filter((x) => String(x.id).includes("clean")).slice(0, 2).entries()) {
    s.push({ sql: "INSERT OR IGNORE INTO work_offers (id, job_id, provider_id, price_ugx, eta_minutes, message, status) VALUES (?, 'prac_wj_7', ?, ?, ?, ?, 'pending')", args: [`prac_wo_${i}`, String(p.id), 35_000 + i * 5_000, 25 + i * 10, i ? "Two cleaners, finishing faster." : "Available now."] });
  }
  const live = providerFor("clean");
  [[0, 0.012], [1, 0.009], [2, 0.006], [3, 0.003]].forEach(([i, d]) => s.push({
    sql: "INSERT INTO work_job_locations (job_id, provider_id, lat, lng, accuracy_m, recorded_at) VALUES ('prac_wj_4', ?, ?, ?, 12, " + when(`-${15 - Number(i) * 4} minutes`) + ")",
    args: [String(live.id), PRACTICE_CUSTOMERS[3]!.lat + Number(d), PRACTICE_CUSTOMERS[3]!.lng],
  }));
  const photos: Array<[string, string, string, string]> = [["prac_wp_1", "prac_wj_1", "before", "Before"], ["prac_wp_2", "prac_wj_1", "after", "After"], ["prac_wp_3", "prac_wj_4", "before", "Kitchen"], ["prac_wp_4", "prac_wj_3", "request", "The leaking tap"]];
  let bucket: ReturnType<typeof getR2Bucket> | null = null;
  try { bucket = getR2Bucket(); } catch { /* no file store here: the rows exist, the pictures appear once one is bound */ }
  for (const [id, job, phase, label] of photos) {
    const key = `work/practice/${id}.svg`;
    if (bucket) await bucket.put(key, photoSvg(label, phase === "after" ? "#3b8f5f" : "#8a6f3b"), { httpMetadata: { contentType: "image/svg+xml" } });
    s.push({ sql: "INSERT OR IGNORE INTO work_job_photos (id, job_id, uploader_id, uploader_kind, phase, storage_key, content_type, size_bytes, note, environment) VALUES (?, ?, ?, ?, ?, ?, 'image/svg+xml', 800, ?, 'sandbox')", args: [id, job, phase === "request" ? PRACTICE_CUSTOMERS[2]!.id : String(live.user_id), phase === "request" ? "customer" : "provider", phase, key, label] });
  }
  s.push({
    sql: `INSERT OR IGNORE INTO work_flags (id, job_id, provider_id, customer_id, kind, cancelled_by, onsite_minutes, closest_m, points, radius_m, min_minutes, status, environment)
          VALUES ('prac_wf_1', 'prac_wj_9', ?, ?, 'cancel_no_location', 'provider', 0, NULL, 0, 150, 5, 'open', 'sandbox')`,
    args: [String(providerFor("laundry").id), PRACTICE_CUSTOMERS[2]!.id],
  });
  await runSeed(s);

  // ---- Hire --------------------------------------------------------------------------------
  // The sample-data installer clears the sample workers first, so what points at them is cleared before, and laid down again after.
  await runSeed([
    "talent_reviews", "talent_money", "talent_events", "talent_milestones", "talent_messages", "talent_contracts", "talent_applications", "talent_invites", "talent_contact_unlocks",
    "talent_recurrences", "talent_subscriptions", "talent_charges", "talent_reports",
  ].map((table) => ({ sql: `DELETE FROM ${table} WHERE ${table === "talent_invites" || table === "talent_contact_unlocks" ? (table === "talent_invites" ? "job_id" : "employer_id") : "id"} LIKE 'prac\\_%' ESCAPE '\\'`, args: [] }))
    .concat([{ sql: "DELETE FROM talent_jobs WHERE id LIKE 'prac\\_tj\\_%' ESCAPE '\\'", args: [] }, { sql: "DELETE FROM talent_employers WHERE user_id LIKE 'prac\\_%' ESCAPE '\\'", args: [] }]));
  const seeded = await seedSandboxDemo();
  if (!seeded.ok) return;
  const workers = (await db.execute("SELECT user_id FROM talent_profiles WHERE user_id LIKE 'talent\\_demo\\_%' ESCAPE '\\' ORDER BY user_id")).rows.map((r) => String(r.user_id));
  const hireJobs = (await db.execute("SELECT id, employer_id, type, title, payment_mode, budget_max_ugx FROM talent_jobs WHERE id LIKE 'talent\\_demo\\_%' ESCAPE '\\' ORDER BY id")).rows as Row[];
  const h: DbStatement[] = [];
  const [E1, E2] = [PRACTICE_CUSTOMERS[0]!.id, PRACTICE_CUSTOMERS[1]!.id];
  for (const e of [E1, E2]) {
    h.push({ sql: "INSERT OR IGNORE INTO talent_employers (user_id, business_name, about, verified, activated_at, rating_sum, rating_count, jobs_posted) VALUES (?, ?, 'Practice employer', 1, datetime('now'), 9, 2, 2)", args: [e, e === E1 ? "Amina's Kitchen" : "Brian's Fixers"] });
  }
  // The practice employers post their own jobs, so a practising customer has work to manage as an employer.
  const mine = [
    { id: "prac_tj_1", employer: E1, type: "gig", title: "Help moving a shop's stock on Saturday", category: "tcat_construction", budget: 60_000, status: "open" },
    { id: "prac_tj_2", employer: E1, type: "project", title: "Design a menu and logo for our kitchen", category: "tcat_design", budget: 450_000, status: "filled" },
    { id: "prac_tj_3", employer: E2, type: "hiring", title: "Part-time shop assistant, Entebbe Town", category: "tcat_marketing", budget: 300_000, status: "open" },
  ];
  for (const j of mine) {
    h.push({
      sql: `INSERT OR IGNORE INTO talent_jobs (id, employer_id, type, category_id, title, description, status, area, lat, lng, budget_min_ugx, budget_max_ugx, payment_mode, workers_needed, moderation_state, expires_at, published_at, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Entebbe', 0.0612, 32.4637, ?, ?, ?, 1, 'clear', ${when("+20 days")}, ${when("-2 days")}, 'sandbox')`,
      args: [j.id, j.employer, j.type, j.category, j.title, `${j.title}. Practice listing.`, j.status, Math.round(j.budget * 0.7), j.budget, j.type === "hiring" ? "none" : "escrow"],
    });
  }
  // Applications from the sample workers on the practice jobs, and the workers' own applications on the sample jobs.
  workers.slice(0, 4).forEach((w, i) => h.push({
    sql: `INSERT OR IGNORE INTO talent_applications (id, job_id, worker_id, message, bid_ugx, status) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`prac_ta_${i}`, ["prac_tj_1", "prac_tj_1", "prac_tj_2", "prac_tj_3"][i]!, w, "I have done similar work and can start this week.", 50_000 + i * 10_000, ["applied", "shortlisted", "hired", "applied"][i]!],
  }));
  hireJobs.slice(0, 3).forEach((j, i) => h.push({
    sql: `INSERT OR IGNORE INTO talent_applications (id, job_id, worker_id, message, bid_ugx, status) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`prac_ta_w${i}`, String(j.id), workers[0]!, "Available and nearby, happy to discuss.", 40_000, ["applied", "shortlisted", "applied"][i]!],
  }));
  h.push({ sql: "INSERT OR IGNORE INTO talent_messages (id, application_id, sender_id, body) VALUES ('prac_tm_1', 'prac_ta_1', ?, 'Can you start Saturday at 7am?')", args: [E1] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_messages (id, application_id, sender_id, body) VALUES ('prac_tm_2', 'prac_ta_1', ?, 'Yes, I will bring a helper.')", args: [workers[1]!] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_invites (job_id, worker_id) VALUES ('prac_tj_1', ?)", args: [workers[2]!] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_contact_unlocks (employer_id, worker_id) VALUES (?, ?)", args: [E1, workers[1]!] });
  // Contracts: one finished with every milestone paid and rated, one running with a milestone waiting for approval.
  h.push({
    sql: `INSERT OR IGNORE INTO talent_contracts (id, job_id, application_id, employer_id, worker_id, title, price_ugx, payment_mode, status, held_ugx, employer_fee_ugx, worker_fee_ugx, commission_ugx,
                                                 paid_to_worker_ugx, settled_at, environment, created_at)
          VALUES ('prac_tc_1', 'prac_tj_2', 'prac_ta_2', ?, ?, 'Design a menu and logo for our kitchen', 450000, 'escrow', 'active', 225000, 0, 22500, 22500, 202500, NULL, 'sandbox', ${when("-12 days")})`,
    args: [E1, workers[2]!],
  });
  [["prac_tms_1", 1, "Logo concepts", 225_000, "released"], ["prac_tms_2", 2, "Menu design and print files", 225_000, "submitted"]].forEach(([id, pos, title, amount, status]) => h.push({
    sql: `INSERT OR IGNORE INTO talent_milestones (id, contract_id, position, title, amount_ugx, status, submitted_at, released_at, confirm_by) VALUES (?, 'prac_tc_1', ?, ?, ?, ?, ${when("-1 days")}, ${status === "released" ? when("-6 days") : "NULL"}, ${status === "submitted" ? when("+2 days") : "NULL"})`,
    args: [String(id), Number(pos), String(title), Number(amount), String(status)],
  }));
  h.push({ sql: "INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, environment, done_at) VALUES ('prac_tmn_1', 'prac_tc_1', ?, 'hold', 450000, 'done', 'sandbox', " + when("-12 days") + ")", args: [E1] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, environment, done_at) VALUES ('prac_tmn_2', 'prac_tc_1', ?, 'payout', 202500, 'done', 'sandbox', " + when("-6 days") + ")", args: [workers[2]!] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_reviews (id, contract_id, from_user, to_user, direction, rating, comment) VALUES ('prac_tr_1', 'prac_tc_1', ?, ?, 'employer_to_worker', 5, 'Creative, quick and easy to work with.')", args: [E1, workers[2]!] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_reviews (id, contract_id, from_user, to_user, direction, rating, comment) VALUES ('prac_tr_2', 'prac_tc_1', ?, ?, 'worker_to_employer', 5, 'Clear brief and paid on time.')", args: [workers[2]!, E1] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) VALUES ('prac_tev_1', 'prac_tj_2', 'prac_tc_1', ?, 'employer', 'hired', 'Hired from applications')", args: [E1] });
  // Repeat jobs, memberships, a fee, a report.
  h.push({
    sql: `INSERT OR IGNORE INTO talent_recurrences (id, employer_id, kind, source_job_id, worker_id, title, price_ugx, frequency, next_run_at, max_runs, runs_done, status, environment)
          VALUES ('prac_tre_1', ?, 'rehire', 'prac_tj_1', ?, 'Weekly stock help', 60000, 'weekly', ${when("+4 days")}, 12, 3, 'active', 'sandbox')`,
    args: [E1, workers[1]!],
  });
  const plan = (await db.execute("SELECT id, audience, price_ugx FROM talent_plans WHERE active = 1")).rows as Row[];
  for (const [i, p] of plan.slice(0, 2).entries()) {
    h.push({
      sql: `INSERT OR IGNORE INTO talent_subscriptions (id, user_id, audience, plan_id, status, auto_renew, expires_at, price_paid_ugx, environment) VALUES (?, ?, ?, ?, 'active', 1, ${when("+25 days")}, ?, 'sandbox')`,
      args: [`prac_tsub_${i}`, p.audience === "worker" ? workers[1]! : E1, String(p.audience), String(p.id), Number(p.price_ugx) || 0],
    });
  }
  h.push({ sql: "INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, amount_ugx, status, reason, idempotency_key, environment) VALUES ('prac_tch_1', ?, 'listing', 'prac_tj_1', 2000, 'paid', 'Gig listing fee', 'prac_tch_1', 'sandbox')", args: [E1] });
  h.push({ sql: "INSERT OR IGNORE INTO talent_reports (id, reporter_id, target_type, target_id, reason, source, status) VALUES ('prac_trep_1', ?, 'job', ?, 'Asks for money upfront', 'user', 'open')", args: [workers[3]!, String(hireJobs[0]!.id)] });
  await runSeed(h);
}
