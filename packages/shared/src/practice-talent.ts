/**
 * Peebee Jobs in practice mode: a browser-local simulator of /v1/talent.
 *
 * Practice mode never reaches the real API for operational requests, so the Jobs
 * screens need their own sample backend. This one keeps everything in
 * localStorage, seeds realistic sample workers, jobs and contracts, and moves money
 * only in a simulated practice wallet. Nothing here can create a real job, charge a
 * real wallet or message a real person.
 */

type Json = Record<string, any>;
type Query = URLSearchParams;

const KEY = "peebee_practice_talent_v1";
const VERSION = 2;
const ME = "practice-user";
const EMPLOYER_FEE = 0.03;
const WORKER_FEE = 0.1;
const LATE_FEE = 5000;

const CATEGORIES = [
  ["tcat_cleaning", "Cleaning & housekeeping", "informal"], ["tcat_errands", "Errands & delivery help", "informal"], ["tcat_construction", "Construction & building", "informal"],
  ["tcat_repairs", "Repairs & technicians", "informal"], ["tcat_farm", "Farm & garden", "informal"], ["tcat_events", "Events & hospitality", "informal"],
  ["tcat_beauty", "Beauty & tailoring", "informal"], ["tcat_driving", "Driving & transport", "informal"], ["tcat_security", "Security & care", "informal"],
  ["tcat_tech", "IT, software & data", "professional"], ["tcat_design", "Design & creative", "professional"], ["tcat_writing", "Writing & translation", "professional"],
  ["tcat_marketing", "Marketing & sales", "professional"], ["tcat_finance", "Accounting & finance", "professional"], ["tcat_legal_admin", "Admin, legal & HR", "professional"],
  ["tcat_education", "Teaching & training", "both"], ["tcat_health", "Health & wellness", "professional"], ["tcat_engineering", "Engineering & architecture", "professional"],
  ["tcat_other", "Other lawful work", "both"],
] as const;
const catName = (id: string) => CATEGORIES.find((c) => c[0] === id)?.[1] ?? "";
const catSegment = (id: string) => CATEGORIES.find((c) => c[0] === id)?.[2] ?? "both";

const dbTime = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace("T", " ");
const parse = (s: string) => new Date(`${s.replace(" ", "T")}Z`).getTime();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const err = (status: number, error: string, message: string, extra: Json = {}) => ok({ error, message, ...extra }, status);
const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-UG")}`;

// ---------------------------------------------------------------------------
// Sample people and jobs
// ---------------------------------------------------------------------------

const WORKERS: Json[] = [
  { id: "pw_moses", name: "Moses Okello", headline: "Electrician with 8 years' experience", bio: "Wiring, fittings, solar installs and fault finding. Neat work and fair prices. Covers all of Kampala and Wakiso.", skills: ["electrical", "solar", "wiring"], categories: ["tcat_repairs", "tcat_construction"], area: "Ntinda", rateType: "day", rateUgx: 40000, years: 8, rating: 4.7, count: 10, done: 23, verified: true, remote: false, lat: 0.3476, lng: 32.6126, phone: "+256700111001" },
  { id: "pw_aisha", name: "Aisha Namukasa", headline: "Accountant and bookkeeper for small businesses", bio: "ACCA-qualified. I keep your books straight, prepare URA returns and monthly reports. Remote or on site.", skills: ["bookkeeping", "tax", "quickbooks"], categories: ["tcat_finance"], area: "Kololo", rateType: "hour", rateUgx: 25000, years: 6, rating: 4.8, count: 5, done: 9, verified: true, remote: true, lat: 0.3326, lng: 32.5886, phone: "+256700111002" },
  { id: "pw_david", name: "David Ssemwogerere", headline: "Reliable home and office cleaner", bio: "Deep cleaning, post-construction clean-ups and regular weekly cleaning. Own equipment.", skills: ["cleaning", "laundry"], categories: ["tcat_cleaning"], area: "Bugolobi", rateType: "day", rateUgx: 30000, years: 4, rating: 4.7, count: 3, done: 4, verified: false, remote: false, lat: 0.3136, lng: 32.6186, phone: "+256700111003" },
  { id: "pw_peter", name: "Peter Kato", headline: "Errands, deliveries and queue help", bio: "Boda rider with free time between trips. Fast errands around town.", skills: ["errands", "delivery"], categories: ["tcat_errands", "tcat_driving"], area: "Kamwokya", rateType: "job", rateUgx: 8000, years: 3, rating: null, count: 0, done: 0, verified: false, remote: false, lat: 0.3426, lng: 32.5806, phone: "+256700111004", rider: true },
  { id: "pw_sarah", name: "Sarah Nabirye", headline: "Graphic designer: logos, menus and social media", bio: "Brand identities and print-ready designs for small businesses. Quick turnaround, unlimited revisions on logos.", skills: ["logo", "branding", "canva", "illustration"], categories: ["tcat_design", "tcat_marketing"], area: "Muyenga", rateType: "job", rateUgx: 120000, years: 5, rating: 4.9, count: 14, done: 31, verified: true, remote: true, lat: 0.2986, lng: 32.6066, phone: "+256700111005" },
  { id: "pw_joseph", name: "Joseph Mugisha", headline: "Mathematics and physics tutor (S1 to S6)", bio: "Former teacher. Home lessons and online classes. Exam preparation for UCE and UACE.", skills: ["mathematics", "physics", "exam prep"], categories: ["tcat_education"], area: "Entebbe", rateType: "hour", rateUgx: 20000, years: 9, rating: 4.6, count: 8, done: 15, verified: true, remote: true, lat: 0.0516, lng: 32.4637, phone: "+256700111006" },
  { id: "pw_grace", name: "Grace Atim", headline: "Event hostess and waitress", bio: "Weddings, corporate events and restaurant shifts. Smart, punctual and friendly.", skills: ["serving", "hosting", "customer service"], categories: ["tcat_events"], area: "Nakasero", rateType: "day", rateUgx: 50000, years: 3, rating: 4.4, count: 6, done: 12, verified: false, remote: false, lat: 0.3226, lng: 32.5786, phone: "+256700111007" },
  { id: "pw_ivan", name: "Ivan Kigozi", headline: "Full-stack web developer", bio: "React, Node and mobile-friendly websites for small businesses. Fixed-price projects with clear milestones.", skills: ["react", "node", "wordpress", "seo"], categories: ["tcat_tech"], area: "Bukoto", rateType: "job", rateUgx: 600000, years: 7, rating: 4.8, count: 11, done: 19, verified: true, remote: true, lat: 0.3516, lng: 32.6016, phone: "+256700111008" },
];

const EMPLOYERS: Json[] = [
  { id: "pe_cafe", name: "Kampala Cafe", rating: 4.6, count: 8, verified: true },
  { id: "pe_mama", name: "Mama Joy Catering", rating: 4.9, count: 21, verified: true },
  { id: "pe_stella", name: "Stella Properties", rating: 4.2, count: 5, verified: false },
  { id: "pe_tech", name: "BrightEdge Solutions", rating: null, count: 0, verified: false },
];

type Seed = { id: string; employer: string; type: string; title: string; description: string; category: string; area: string | null; remote?: boolean; min: number; max: number; mode: string; need?: number; employment?: string; skills?: string[]; lat?: number; lng?: number; ageH: number; applied?: number };
const JOBS: Seed[] = [
  { id: "pj_clean", employer: "pe_cafe", type: "gig", title: "Deep clean the cafe before our reopening", description: "Kitchen, dining area, windows and toilets. Two people for one day. Cleaning products provided.", category: "tcat_cleaning", area: "Kamwokya", min: 120000, max: 120000, mode: "escrow", need: 2, lat: 0.3426, lng: 32.5806, ageH: 3, applied: 2 },
  { id: "pj_socket", employer: "pe_stella", type: "gig", title: "Fix a faulty socket and install two lights", description: "Two bedroom house in Ntinda. Need a qualified electrician for a morning.", category: "tcat_repairs", area: "Ntinda", min: 80000, max: 80000, mode: "direct", lat: 0.3476, lng: 32.6126, ageH: 6, applied: 1 },
  { id: "pj_move", employer: "pe_mama", type: "gig", title: "Help move catering equipment to a wedding venue", description: "Loading and unloading pots, chairs and tents at 6am in Kololo, then setting up. Four hours.", category: "tcat_errands", area: "Kololo", min: 60000, max: 60000, mode: "escrow", need: 3, lat: 0.3326, lng: 32.5886, ageH: 9, applied: 4 },
  { id: "pj_site", employer: "pe_cafe", type: "project", title: "Build a simple website with online menu", description: "We want a 5-page website with our menu, photos, opening hours and a contact form. Mobile friendly.", category: "tcat_tech", area: null, remote: true, min: 400000, max: 900000, mode: "escrow", skills: ["react", "design"], ageH: 20, applied: 3 },
  { id: "pj_logo", employer: "pe_tech", type: "project", title: "Logo and brand kit for a new startup", description: "Logo, colours, business card and social media banners. Modern look, we will share examples.", category: "tcat_design", area: null, remote: true, min: 250000, max: 500000, mode: "escrow", ageH: 30, applied: 6 },
  { id: "pj_translate", employer: "pe_mama", type: "project", title: "Translate our menu and flyers into Luganda", description: "Around 40 menu items and two flyers. Natural, friendly wording.", category: "tcat_writing", area: null, remote: true, min: 80000, max: 150000, mode: "direct", ageH: 44, applied: 2 },
  { id: "pj_waiter", employer: "pe_cafe", type: "hiring", title: "Waiter / waitress", description: "Friendly, punctual and honest. Evening shifts, Thursday to Sunday. Training provided.", category: "tcat_events", area: "Kamwokya", min: 0, max: 350000, mode: "none", employment: "part_time", lat: 0.3426, lng: 32.5806, ageH: 12, applied: 9 },
  { id: "pj_accountant", employer: "pe_stella", type: "hiring", title: "Accounts assistant", description: "Full time role managing invoices, payments and monthly reports for a property company. Diploma in accounting required.", category: "tcat_finance", area: "Kololo", min: 0, max: 900000, mode: "none", employment: "full_time", lat: 0.3326, lng: 32.5886, ageH: 50, applied: 14 },
  { id: "pj_teacher", employer: "pe_tech", type: "hiring", title: "Maths teacher for a private academy", description: "Part-time evening classes for secondary students, three days a week.", category: "tcat_education", area: "Entebbe", min: 0, max: 600000, mode: "none", employment: "contract", lat: 0.0516, lng: 32.4637, ageH: 70, applied: 5 },
];

/** The same sample people and jobs, for seeding sandbox data on the real API. */
export const TALENT_DEMO = { workers: WORKERS, employers: EMPLOYERS, jobs: JOBS, categories: CATEGORIES.map(([id]) => id) };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type State = {
  v: number;
  wallet: number;
  profile: Json | null;
  employer: Json | null;
  jobs: Json[];
  apps: Json[];
  contracts: Json[];
  messages: Record<string, Json[]>;
  recurrences: Json[];
  reviews: Json[];
  subs: Json[];
  unlocked: string[];
  invites: string[];
  earnedPaid: number;
  owed: number;
};

function jobFromSeed(s: Seed): Json {
  return {
    id: s.id, employerId: s.employer, type: s.type, title: s.title, description: s.description, status: "open", categoryId: s.category, area: s.area, address: null,
    lat: s.lat ?? null, lng: s.lng ?? null, remote: Boolean(s.remote), skills: s.skills ?? [], startsAt: null, deadline: null, budgetMin: s.min, budgetMax: s.max, mode: s.mode,
    need: s.need ?? 1, employment: s.employment ?? null, boostedUntil: s.id === "pj_clean" ? dbTime(86_400_000) : null, applied: s.applied ?? 0, createdAt: dbTime(-s.ageH * 3_600_000),
    expiresAt: dbTime(20 * 86_400_000),
  };
}

function seedState(): State {
  const jobs = JOBS.map(jobFromSeed);
  // Work you've posted yourself, so every screen has something to show straight away.
  const mine: Json = { id: "pj_mine_gig", employerId: ME, type: "gig", title: "Paint my living room", description: "Two coats, I will buy the paint. Room is 4m by 5m.", status: "open", categoryId: "tcat_construction", area: "Muyenga", address: null, lat: 0.2986, lng: 32.6066, remote: false, skills: [], startsAt: null, deadline: null, budgetMin: 150000, budgetMax: 150000, mode: "escrow", need: 1, employment: null, boostedUntil: null, applied: 2, createdAt: dbTime(-5 * 3_600_000), expiresAt: dbTime(25 * 86_400_000) };
  const running: Json = { id: "pj_mine_run", employerId: ME, type: "gig", title: "Weekly deep clean of my flat", description: "Every Saturday morning. Floors, kitchen, bathrooms and windows.", status: "in_progress", categoryId: "tcat_cleaning", area: "Kololo", address: null, lat: 0.3326, lng: 32.5886, remote: false, skills: [], startsAt: null, deadline: null, budgetMin: 60000, budgetMax: 60000, mode: "escrow", need: 1, employment: null, boostedUntil: null, applied: 1, createdAt: dbTime(-3 * 86_400_000), expiresAt: dbTime(20 * 86_400_000) };
  const theirs = jobs.find((j) => j.id === "pj_socket")!;
  const apps: Json[] = [
    { id: "pa_mine1", jobId: "pj_mine_gig", workerId: "pw_david", message: "I can do this on Saturday with my own ladder and brushes.", bid: 140000, status: "applied", createdAt: dbTime(-3_600_000) },
    { id: "pa_mine2", jobId: "pj_mine_gig", workerId: "pw_moses", message: "Experienced painter. I can start tomorrow.", bid: 150000, status: "shortlisted", createdAt: dbTime(-2 * 3_600_000) },
    { id: "pa_run", jobId: "pj_mine_run", workerId: "pw_david", message: "Happy to do this every week.", bid: 60000, status: "accepted", createdAt: dbTime(-3 * 86_400_000) },
    { id: "pa_work", jobId: "pj_socket", workerId: ME, message: "I'm a qualified electrician and can come tomorrow morning.", bid: 80000, status: "accepted", createdAt: dbTime(-2 * 86_400_000) },
  ];
  const contracts: Json[] = [
    { id: "pc_run", jobId: "pj_mine_run", appId: "pa_run", employerId: ME, workerId: "pw_david", title: "Weekly deep clean of my flat", price: 60000, mode: "escrow", status: "active", held: 61800, createdAt: dbTime(-2 * 86_400_000), milestones: [{ id: "pm_run1", title: "Weekly deep clean of my flat", amount: 60000, status: "submitted", note: "All done. Windows and balcony too.", submittedAt: dbTime(-1_800_000), confirmBy: dbTime(70 * 3_600_000) }], settledAt: null, cancelFee: 0, otherName: "David Ssemwogerere", otherPhone: "+256700111003" },
    { id: "pc_work", jobId: "pj_socket", appId: "pa_work", employerId: "pe_stella", workerId: ME, title: "Fix a faulty socket and install two lights", price: 80000, mode: "direct", status: "active", held: 0, createdAt: dbTime(-86_400_000), milestones: [{ id: "pm_work1", title: "Fix a faulty socket and install two lights", amount: 80000, status: "pending", note: null, submittedAt: null, confirmBy: null }], settledAt: null, cancelFee: 0, otherName: "Stella Properties", otherPhone: "+256700222003" },
  ];
  jobs.push(mine, running);
  void theirs;
  return {
    v: VERSION, wallet: 480_000, profile: null, employer: null, jobs, apps, contracts, messages: {
      pa_mine2: [{ id: "pmg1", mine: false, body: "Hello! I can start tomorrow. Where exactly is the house?", createdAt: dbTime(-3_000_000) }],
    },
    recurrences: [{ id: "pr_run", kind: "rehire", sourceJobId: "pj_mine_run", workerId: "pw_david", title: "Weekly deep clean of my flat", price: 60000, frequency: "weekly", nextRunAt: dbTime(5 * 86_400_000), maxRuns: 8, runsDone: 1, status: "active", lastError: null }],
    reviews: [], subs: [], unlocked: [], invites: ["pj_clean"], earnedPaid: 0, owed: 0,
  };
}

function load(): State {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.v === VERSION) return s;
    }
  } catch {
    /* fall through to a fresh scenario */
  }
  const s = seedState();
  save(s);
  return s;
}
function save(s: State) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the scenario just won't persist */
  }
}
export function resetPracticeTalent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

// ---------------------------------------------------------------------------
// Simulated time: other people respond a few seconds after you act
// ---------------------------------------------------------------------------

function advance(s: State) {
  const now = Date.now();
  let changed = false;
  for (const a of s.apps) {
    // An employer answers an application you sent a few seconds ago.
    if (a.workerId === ME && a.status === "applied" && now - parse(a.createdAt) > 6_000 && !a.auto) {
      a.auto = true;
      const job = s.jobs.find((j) => j.id === a.jobId);
      if (job && job.type !== "hiring" && !s.contracts.some((c) => c.appId === a.id)) {
        a.status = "accepted";
        const employer = EMPLOYERS.find((e) => e.id === job.employerId);
        s.contracts.unshift({ id: uid("pc"), jobId: job.id, appId: a.id, employerId: job.employerId, workerId: ME, title: job.title, price: a.bid, mode: job.mode === "direct" ? "direct" : "escrow", status: "active", held: 0, createdAt: dbTime(), milestones: [{ id: uid("pm"), title: job.title, amount: a.bid, status: "pending", note: null, submittedAt: null, confirmBy: null }], settledAt: null, cancelFee: 0, otherName: employer?.name ?? "Employer", otherPhone: "+256700222999" });
        job.status = "in_progress";
      } else if (job && job.type === "hiring") {
        a.status = "shortlisted";
      }
      changed = true;
    }
  }
  for (const c of s.contracts) {
    // Work you've done is approved and paid shortly after you submit it.
    if (c.workerId === ME && c.status === "active") {
      for (const m of c.milestones) {
        if (m.status === "submitted" && now > parse(m.submittedAt) + 5_000) {
          m.status = "released";
          s.wallet += Math.round(m.amount * (1 - WORKER_FEE));
          s.earnedPaid += Math.round(m.amount * (1 - WORKER_FEE));
          changed = true;
        }
      }
      if (c.milestones.every((m: Json) => m.status === "released")) { c.status = "settled"; c.settledAt = dbTime(); const j = s.jobs.find((x) => x.id === c.jobId); if (j) j.status = "completed"; changed = true; }
    }
    // A worker you hired starts and submits the work.
    if (c.employerId === ME && c.status === "active" && c.workerId !== ME) {
      const m = c.milestones.find((x: Json) => x.status === "pending");
      if (m && now > parse(c.createdAt) + 8_000 && !m.autoTried) {
        m.autoTried = true;
        m.status = "submitted";
        m.note = "Work completed as agreed. Please have a look.";
        m.submittedAt = dbTime();
        m.confirmBy = dbTime(72 * 3_600_000);
        changed = true;
      }
    }
  }
  if (changed) save(s);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const workerById = (id: string) => WORKERS.find((w) => w.id === id);
const employerName = (id: string) => (id === ME ? "You" : EMPLOYERS.find((e) => e.id === id)?.name ?? "Employer");

function workerView(w: Json, opts: { phone?: boolean; km?: number | null } = {}) {
  return {
    id: w.id, name: w.name, headline: w.headline, bio: w.bio, skills: w.skills, languages: ["English", "Luganda"], categories: (w.categories as string[]).map(catName), area: w.area, remote: Boolean(w.remote), radiusKm: 20,
    rateType: w.rateType, rateUgx: w.rateUgx, experienceYears: w.years, portfolio: [], availability: "available", verified: Boolean(w.verified), featured: w.id === "pw_sarah", rating: w.rating, ratingCount: w.count, jobsCompleted: w.done,
    distanceKm: opts.km ?? null, phone: opts.phone ? w.phone : null, isRider: Boolean(w.rider),
  };
}

function jobView(s: State, j: Json, extra: Json = {}) {
  const e = j.employerId === ME ? { rating: s.employer?.rating ?? null, count: 0, verified: false } : EMPLOYERS.find((x) => x.id === j.employerId) ?? {};
  return {
    id: j.id, type: j.type, title: j.title, description: j.description, status: j.status, category: { id: j.categoryId, name: catName(j.categoryId) }, area: j.area, address: j.address, lat: j.lat, lng: j.lng, remote: j.remote, skills: j.skills,
    startsAt: j.startsAt, deadline: j.deadline, budgetMinUgx: j.budgetMin, budgetMaxUgx: j.budgetMax, paymentMode: j.mode, workersNeeded: j.need, employmentType: j.employment, boosted: Boolean(j.boostedUntil && j.boostedUntil > dbTime()),
    applicationCount: s.apps.filter((a) => a.jobId === j.id).length + (j.employerId === ME ? 0 : j.applied), expiresAt: j.expiresAt, createdAt: j.createdAt,
    employer: { id: j.employerId, name: j.employerId === ME ? (s.employer?.businessName ?? "You") : employerName(j.employerId), verified: Boolean(e.verified), rating: e.rating ?? null, ratingCount: e.count ?? 0 },
    ...extra,
  };
}

function distance(a: Json, lat: number | null, lng: number | null) {
  if (lat == null || lng == null || a.lat == null || a.lng == null) return null;
  const R = 6371, dLat = ((a.lat - lat) * Math.PI) / 180, dLng = ((a.lng - lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((a.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(x)) * 10) / 10;
}

const myProfileView = (p: Json) => ({
  id: ME, name: "You", headline: p.headline, bio: p.bio, skills: p.skills, languages: p.languages ?? [], categories: (p.categoryIds as string[]).map(catName), area: p.area ?? null, remote: Boolean(p.remote), radiusKm: p.radiusKm ?? 10,
  rateType: p.rateType ?? "negotiable", rateUgx: p.rateUgx ?? 0, experienceYears: p.experienceYears ?? 0, portfolio: [], availability: p.availability ?? "available", verified: false, featured: Boolean(p.featured), rating: null, ratingCount: 0,
  jobsCompleted: 0, distanceKm: null, phone: null, isRider: false, status: "approved", statusNote: null, visible: true, activated: true, lat: p.lat ?? null, lng: p.lng ?? null,
});

function membership(s: State) {
  const active = s.subs.filter((x) => x.expiresAt > dbTime());
  const trial = { expiresAt: dbTime(14 * 86_400_000) };
  const side = (aud: string) => ({ trial: active.length === 0 ? trial : null, subscriptions: active.filter((x) => x.audience === aud).map((x) => ({ id: x.id, planCode: x.code, planName: x.name, status: x.trial ? "trial" : "active", expiresAt: x.expiresAt, autoRenew: x.autoRenew })) });
  return { freeAccess: false, worker: side("worker"), employer: side("employer"), owedUgx: s.owed, features: FEATURES.map((f) => ({ ...f, unlocked: true, via: "trial" })) };
}

const FEATURES = [
  { key: "advanced_worker_search", label: "Advanced worker search", description: "Filter workers by rate, rating, verification and availability", audience: "employer", pro: true },
  { key: "contact_unlock", label: "Unlock contact details", description: "See a worker or applicant phone before hiring", audience: "employer", pro: true },
  { key: "recurring_jobs", label: "Recurring jobs", description: "Repeat a job every day, week or month", audience: "employer", pro: true },
  { key: "unlimited_applications", label: "Unlimited applications", description: "No daily cap on applications", audience: "worker", pro: true },
  { key: "featured_profile", label: "Featured profile", description: "Show higher in worker search", audience: "worker", pro: true },
];

const PLANS = [
  { id: "tpl_worker_pro", code: "worker_pro", audience: "worker", name: "Worker Pro", description: "Unlimited applications, a featured profile and lower commission", priceUgx: 15000, listPriceUgx: 15000, periodDays: 30, trialDays: 14, features: FEATURES.filter((f) => f.audience === "worker").map((f) => ({ key: f.key, label: f.label, description: f.description, pro: true })), waivedKinds: ["application", "boost"], workerCommissionPercent: 5, employerCommissionPercent: null },
  { id: "tpl_employer_pro", code: "employer_pro", audience: "employer", name: "Employer Pro", description: "Advanced worker search, contact unlock and free listings", priceUgx: 40000, listPriceUgx: 40000, periodDays: 30, trialDays: 14, features: FEATURES.filter((f) => f.audience === "employer").map((f) => ({ key: f.key, label: f.label, description: f.description, pro: true })), waivedKinds: ["listing", "contact_unlock"], workerCommissionPercent: null, employerCommissionPercent: 2 },
];

function contractSummary(s: State, c: Json) {
  const asWorker = c.workerId === ME;
  const released = c.milestones.filter((m: Json) => m.status === "released").reduce((t: number, m: Json) => t + m.amount, 0);
  return {
    id: c.id, jobId: c.jobId, applicationId: c.appId, title: c.title, status: c.status, paymentMode: c.mode, priceUgx: c.price, heldUgx: c.held, paidToWorkerUgx: Math.round(released * (1 - WORKER_FEE)), refundedUgx: c.refunded ?? 0,
    feeUgx: asWorker ? Math.round(c.price * WORKER_FEE) : c.mode === "escrow" ? Math.round(c.price * EMPLOYER_FEE) : 0, role: asWorker ? "worker" : "employer",
    otherParty: { id: asWorker ? c.employerId : c.workerId, name: asWorker ? employerName(c.employerId) : (c.otherName ?? workerById(c.workerId)?.name ?? "Worker"), phone: c.otherPhone ?? "+256700111000" }, createdAt: c.createdAt, settledAt: c.settledAt,
  };
}

function cancelQuote(c: Json) {
  const ageMin = (Date.now() - parse(c.createdAt)) / 60_000;
  const base = c.milestones.filter((m: Json) => m.status !== "released").reduce((t: number, m: Json) => t + m.amount, 0);
  const free = ageMin <= 30 || base <= 1;
  const fee = free ? 0 : Math.min(LATE_FEE, base - 1);
  return { feeUgx: fee, compensationUgx: Math.round(fee * 0.7), baseUgx: base, free, mode: "flat", percent: 10, flatUgx: LATE_FEE, freeUntil: dbTime(parse(c.createdAt) + 30 * 60_000 - Date.now()) };
}

function contractDetail(s: State, c: Json) {
  const asWorker = c.workerId === ME;
  const active = c.status === "active";
  const rev = s.reviews.find((r) => r.contractId === c.id && r.mine);
  const rep = s.recurrences.find((r) => r.sourceJobId === c.jobId && r.workerId === c.workerId && r.kind === "rehire" && r.status !== "ended");
  return {
    contract: contractSummary(s, c), job: { id: c.jobId, type: "gig" },
    milestones: c.milestones.map((m: Json, i: number) => ({ id: m.id, position: i, title: m.title, amountUgx: m.amount, status: m.status, note: m.note, submittedAt: m.submittedAt, confirmBy: m.confirmBy, releasedAt: m.status === "released" ? c.settledAt ?? dbTime() : null, payoutUgx: Math.round(m.amount * (1 - WORKER_FEE)) })),
    actions: { submit: asWorker && active, release: !asWorker && active, cancel: active && !c.milestones.some((m: Json) => m.status === "submitted"), dispute: active, review: c.status === "settled" && !rev },
    cancelQuote: cancelQuote(c), cancelFeeUgx: c.cancelFee ?? 0, disputeReason: c.disputeReason ?? null, resolutionNote: null, reviewReceived: c.status === "settled" ? { rating: 5, comment: "Great to work with. Paid on time." } : null,
    recurring: { canRepeat: !asWorker && active && !rep, frequencies: ["weekly", "biweekly", "monthly"], existing: rep ? { id: rep.id, frequency: rep.frequency, status: rep.status, nextRunAt: rep.nextRunAt } : null },
    timeline: [{ action: "accepted", by: "employer", at: c.createdAt }],
  };
}

function tryAccept(s: State, app: Json, milestones?: { title: string; amountUgx: number }[]): Response {
  const job = s.jobs.find((j) => j.id === app.jobId)!;
  const price = app.bid > 0 ? app.bid : job.budgetMax;
  const parts = milestones?.length ? milestones : [{ title: job.title, amountUgx: price }];
  if (parts.reduce((t, m) => t + m.amountUgx, 0) !== price) return err(400, "milestones_mismatch", `The milestones must add up to ${ugx(price)}.`);
  const held = job.mode === "escrow" ? Math.round(price * (1 + EMPLOYER_FEE)) : 0;
  if (held > s.wallet) return err(402, "insufficient_funds", `Your wallet needs ${ugx(held)} to hold for this job. Top up and try again.`, { needed: held });
  s.wallet -= held;
  const w = workerById(app.workerId);
  const id = uid("pc");
  s.contracts.unshift({ id, jobId: job.id, appId: app.id, employerId: ME, workerId: app.workerId, title: job.title, price, mode: job.mode === "direct" ? "direct" : "escrow", status: "active", held, createdAt: dbTime(), milestones: parts.map((m) => ({ id: uid("pm"), title: m.title, amount: m.amountUgx, status: "pending", note: null, submittedAt: null, confirmBy: null })), settledAt: null, cancelFee: 0, otherName: w?.name, otherPhone: w?.phone });
  app.status = "accepted";
  if (s.apps.filter((a) => a.jobId === job.id && a.status === "accepted").length >= job.need) job.status = "in_progress";
  save(s);
  return ok({ contractId: id, priceUgx: price, heldUgx: held, paymentMode: job.mode, employerFeeUgx: Math.round(price * EMPLOYER_FEE), workerFeeUgx: Math.round(price * WORKER_FEE) }, 201);
}

function releaseMilestone(s: State, c: Json, m: Json) {
  m.status = "released";
  const payout = Math.round(m.amount * (1 - WORKER_FEE));
  if (c.workerId !== ME) { c.held = Math.max(0, c.held - Math.round(m.amount * (1 + EMPLOYER_FEE))); }
  if (c.milestones.every((x: Json) => x.status === "released")) { c.status = "settled"; c.settledAt = dbTime(); const j = s.jobs.find((x) => x.id === c.jobId); if (j) j.status = "completed"; }
  void payout;
}

function addPeriod(iso: string, f: string) {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  if (f === "daily") d.setUTCDate(d.getUTCDate() + 1); else if (f === "weekly") d.setUTCDate(d.getUTCDate() + 7); else if (f === "biweekly") d.setUTCDate(d.getUTCDate() + 14); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ---------------------------------------------------------------------------
// The request handler
// ---------------------------------------------------------------------------

export function practiceTalentRequest(path: string, method: string, body: Json, q: Query): Response {
  const s = load();
  advance(s);
  const p = path.replace(/^\/v1\/talent/, "");
  const m = (re: RegExp) => p.match(re);
  let r: RegExpMatchArray | null;

  if (method === "GET" && p === "/config") {
    return ok({
      enabled: true, jobTypes: ["gig", "project", "hiring"], workerSearchEnabled: true, paymentModes: ["escrow", "direct"], defaultPaymentMode: "escrow", ridersCanWork: true, freeAccess: false, freeOnboarding: true, trialDays: 14,
      reviewsEnabled: true, chatEnabled: true,
      limits: { minJobUgx: 5000, maxJobUgx: 50_000_000, maxMilestones: 10, maxWorkersPerJob: 20, maxSkills: 15, searchRadiusKm: 25, boostDays: 7, autoConfirmHours: 72, jobExpiryDays: 30 },
      recurring: { enabled: true, frequencies: ["weekly", "biweekly", "monthly"], maxRuns: 52, maxActive: 5 }, cancellation: { freeMinutes: 30, mode: "flat", feeUgx: LATE_FEE, feePercent: 10, partySharePercent: 70 },
      categories: CATEGORIES.map(([id, name, segment]) => ({ id, parentId: null, name, segment, icon: null })),
      fees: [
        { kind: "listing", jobType: "gig", model: "flat", flatUgx: 2000, percent: 0, minUgx: 0, maxUgx: 0, freeFirstN: 3, note: "" },
        { kind: "listing", jobType: "hiring", model: "flat", flatUgx: 20000, percent: 0, minUgx: 0, maxUgx: 0, freeFirstN: 0, note: "" },
        { kind: "application", jobType: "", model: "flat", flatUgx: 500, percent: 0, minUgx: 0, maxUgx: 0, freeFirstN: 10, note: "" },
        { kind: "worker_commission", jobType: "gig", model: "percent", flatUgx: 0, percent: 10, minUgx: 0, maxUgx: 0, freeFirstN: 0, note: "" },
        { kind: "employer_commission", jobType: "", model: "percent", flatUgx: 0, percent: 3, minUgx: 0, maxUgx: 0, freeFirstN: 0, note: "" },
      ],
    });
  }

  if (method === "GET" && p === "/me") {
    const pending = s.apps.filter((a) => a.workerId === ME && ["applied", "shortlisted"].includes(a.status)).length;
    return ok({
      profile: s.profile ? myProfileView(s.profile) : null, employer: s.employer ? { businessName: s.employer.businessName ?? null, about: s.employer.about ?? "", verified: false, status: "active", rating: null, ratingCount: 0 } : null,
      counts: { openJobs: s.jobs.filter((j) => j.employerId === ME && ["open", "in_progress"].includes(j.status)).length, pendingApplications: pending, workInProgress: s.contracts.filter((c) => c.workerId === ME && c.status === "active").length, hiringInProgress: s.contracts.filter((c) => c.employerId === ME && c.status === "active").length, invites: s.invites.length },
      membership: membership(s), canWork: true,
    });
  }

  // ---- profile ----
  if (method === "PUT" && p === "/profile") {
    s.profile = { ...(s.profile ?? {}), ...body, categoryIds: body.categoryIds ?? [], skills: body.skills ?? [], featured: s.profile?.featured };
    save(s);
    return ok({ ok: true, activation: { required: false, amountUgx: 0 }, status: { status: "approved", activated: true } });
  }
  if (method === "POST" && p === "/profile/activate") return ok({ ok: true, activated: true });
  if (method === "PATCH" && p === "/profile/availability") { if (s.profile) { s.profile.availability = body.availability ?? s.profile.availability; save(s); } return ok({ ok: true }); }
  if (method === "POST" && p === "/profile/boost") { if (s.profile) { s.profile.featured = true; save(s); } return ok({ ok: true, featuredUntil: dbTime(7 * 86_400_000), charged: 0 }); }
  if (method === "PUT" && p === "/employer") { s.employer = { ...(s.employer ?? {}), businessName: body.businessName, about: body.about }; save(s); return ok({ ok: true }); }

  // ---- workers ----
  if (method === "GET" && p === "/workers") {
    const lat = q.get("lat") ? Number(q.get("lat")) : null, lng = q.get("lng") ? Number(q.get("lng")) : null;
    let rows = WORKERS.filter((w) => {
      if (q.get("category") && !w.categories.includes(q.get("category"))) return false;
      if (q.get("segment") && !w.categories.some((c: string) => [q.get("segment"), "both"].includes(catSegment(c)))) return false;
      if (q.get("remote") === "1" && !w.remote) return false;
      if (q.get("minRating") && (w.rating ?? 0) < Number(q.get("minRating"))) return false;
      if (q.get("maxRate") && w.rateUgx > Number(q.get("maxRate"))) return false;
      if (q.get("verifiedOnly") === "1" && !w.verified) return false;
      const text = q.get("q")?.toLowerCase();
      if (text && !`${w.name} ${w.headline} ${w.bio} ${w.skills.join(" ")} ${w.categories.map(catName).join(" ")}`.toLowerCase().includes(text)) return false;
      return true;
    }).map((w) => ({ w, km: distance(w, lat, lng) }));
    const sort = q.get("sort") ?? "best";
    rows.sort((a, b) => sort === "nearest" ? (a.km ?? 1e9) - (b.km ?? 1e9) : sort === "rate_low" ? a.w.rateUgx - b.w.rateUgx : (b.w.rating ?? 3) - (a.w.rating ?? 3));
    rows = rows.slice(0, 20);
    return ok({ total: rows.length, workers: rows.map(({ w, km }) => workerView(w, { km })) });
  }
  if (method === "GET" && (r = m(/^\/workers\/([^/]+)$/))) {
    const w = workerById(r[1]);
    if (!w) return err(404, "not_found", "That worker isn't available.");
    const open = s.unlocked.includes(w.id) || s.contracts.some((c) => c.workerId === w.id && c.employerId === ME);
    return ok({ worker: workerView(w, { phone: open }), phoneLocked: !open, reviews: w.count ? [{ rating: 5, comment: "Professional and on time. Would hire again.", createdAt: dbTime(-9 * 86_400_000), from: "Kampala" }, { rating: 4, comment: "Good work, a little late but communicated well.", createdAt: dbTime(-30 * 86_400_000), from: "Entebbe" }] : [] });
  }
  if (method === "POST" && (r = m(/^\/workers\/([^/]+)\/unlock-contact$/))) {
    const w = workerById(r[1]);
    if (!w) return err(404, "not_found", "Not found");
    if (!s.unlocked.includes(w.id)) { s.unlocked.push(w.id); save(s); }
    return ok({ ok: true, phone: w.phone, charged: 0 });
  }

  // ---- jobs ----
  if (method === "GET" && p === "/jobs") {
    const lat = q.get("lat") ? Number(q.get("lat")) : null, lng = q.get("lng") ? Number(q.get("lng")) : null;
    let rows = s.jobs.filter((j) => j.employerId !== ME && j.status === "open").filter((j) => {
      if (q.get("type") && j.type !== q.get("type")) return false;
      if (q.get("category") && j.categoryId !== q.get("category")) return false;
      if (q.get("segment") && ![q.get("segment"), "both"].includes(catSegment(j.categoryId))) return false;
      if (q.get("remote") === "1" && !j.remote) return false;
      const text = q.get("q")?.toLowerCase();
      if (text && !`${j.title} ${j.description} ${j.skills.join(" ")}`.toLowerCase().includes(text)) return false;
      return true;
    }).map((j) => ({ j, km: distance(j, lat, lng) }));
    const sort = q.get("sort") ?? "newest";
    rows.sort((a, b) => sort === "budget" ? b.j.budgetMax - a.j.budgetMax : sort === "nearest" ? (a.km ?? 1e9) - (b.km ?? 1e9) : (b.j.boostedUntil ? 1 : 0) - (a.j.boostedUntil ? 1 : 0) || b.j.createdAt.localeCompare(a.j.createdAt));
    return ok({ total: rows.length, jobs: rows.slice(0, 30).map(({ j, km }) => jobView(s, j, { distanceKm: km, myApplication: s.apps.find((a) => a.jobId === j.id && a.workerId === ME)?.status ?? null, invited: s.invites.includes(j.id) })) });
  }
  if (method === "GET" && p === "/jobs/mine") {
    const mine = s.jobs.filter((j) => j.employerId === ME).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ jobs: mine.map((j) => jobView(s, j, { pendingApplications: s.apps.filter((a) => a.jobId === j.id && ["applied", "shortlisted"].includes(a.status)).length })) });
  }
  if (method === "POST" && p === "/jobs") {
    const id = uid("pj");
    const job: Json = { id, employerId: ME, type: body.type, title: body.title, description: body.description, status: "open", categoryId: body.categoryId, area: body.area ?? null, address: body.address ?? null, lat: body.lat ?? null, lng: body.lng ?? null, remote: Boolean(body.remote), skills: body.skills ?? [], startsAt: null, deadline: null, budgetMin: body.budgetMinUgx ?? body.budgetMaxUgx ?? 0, budgetMax: body.budgetMaxUgx ?? 0, mode: body.type === "hiring" ? "none" : body.paymentMode ?? "escrow", need: body.workersNeeded ?? 1, employment: body.employmentType ?? null, boostedUntil: null, applied: 0, createdAt: dbTime(), expiresAt: dbTime(30 * 86_400_000) };
    s.jobs.unshift(job);
    // Interested workers reply with a couple of applications.
    const matches = WORKERS.filter((w) => w.categories.includes(job.categoryId) || w.remote).slice(0, 2);
    matches.forEach((w, i) => s.apps.push({ id: uid("pa"), jobId: id, workerId: w.id, message: i === 0 ? "I'm interested and available this week. Happy to discuss." : "I have done similar work many times. Let me know the details.", bid: job.type === "hiring" ? 0 : Math.round((job.budgetMax || 100000) * (i ? 0.95 : 1)), status: "applied", createdAt: dbTime(-60_000 * (i + 1)) }));
    save(s);
    return ok({ job: jobView(s, job), charged: 0, needsReview: false }, 201);
  }
  if (method === "GET" && (r = m(/^\/jobs\/([^/]+)$/))) {
    const j = s.jobs.find((x) => x.id === r![1]);
    if (!j) return err(404, "not_found", "That job isn't available.");
    const app = s.apps.find((a) => a.jobId === j.id && a.workerId === ME);
    const contract = app ? s.contracts.find((c) => c.appId === app.id) : undefined;
    return ok({ job: jobView(s, j, { isMine: j.employerId === ME, invited: s.invites.includes(j.id), myApplication: app ? { id: app.id, status: app.status, bidUgx: app.bid, message: app.message, contractId: contract?.id ?? null, contractStatus: contract?.status ?? null } : null, boostable: j.employerId === ME && j.status === "open", freeAccess: false }) });
  }
  if (method === "PATCH" && (r = m(/^\/jobs\/([^/]+)$/))) { const j = s.jobs.find((x) => x.id === r![1]); if (j) { Object.assign(j, body.title ? { title: body.title } : {}, body.description ? { description: body.description } : {}); save(s); return ok({ job: jobView(s, j) }); } return err(404, "not_found", "Not found"); }
  if (method === "POST" && (r = m(/^\/jobs\/([^/]+)\/close$/))) { const j = s.jobs.find((x) => x.id === r![1]); if (j) { j.status = "closed"; save(s); } return ok({ ok: true }); }
  if (method === "POST" && (r = m(/^\/jobs\/([^/]+)\/boost$/))) { const j = s.jobs.find((x) => x.id === r![1]); if (j) { j.boostedUntil = dbTime(7 * 86_400_000); save(s); } return ok({ ok: true, boostedUntil: dbTime(7 * 86_400_000), charged: 0 }); }
  if (method === "POST" && (r = m(/^\/jobs\/([^/]+)\/invite$/))) return ok({ ok: true });
  if (method === "POST" && (r = m(/^\/jobs\/([^/]+)\/repeat$/))) {
    const j = s.jobs.find((x) => x.id === r![1]);
    if (!j) return err(404, "not_found", "Not found");
    s.recurrences.push({ id: uid("pr"), kind: "repost", sourceJobId: j.id, workerId: null, title: j.title, price: j.budgetMax, frequency: body.frequency, nextRunAt: addPeriod(dbTime(), body.frequency), maxRuns: body.maxRuns ?? 52, runsDone: 0, status: "active", lastError: null });
    save(s);
    return ok({ id: s.recurrences[s.recurrences.length - 1].id }, 201);
  }
  if (method === "POST" && (r = m(/^\/jobs\/([^/]+)\/apply$/))) {
    const j = s.jobs.find((x) => x.id === r![1]);
    if (!j || j.status !== "open") return err(409, "not_open", "This job isn't taking applications.");
    if (!s.profile) return err(403, "profile_required", "Create your worker profile to apply.");
    if (s.apps.some((a) => a.jobId === j.id && a.workerId === ME && a.status !== "withdrawn")) return err(409, "already_applied", "You've already applied to this job.");
    const bid = j.type === "hiring" ? 0 : Number(body.bidUgx) > 0 ? Number(body.bidUgx) : j.budgetMax;
    const a = { id: uid("pa"), jobId: j.id, workerId: ME, message: body.message ?? "", bid, status: "applied", createdAt: dbTime() };
    s.apps.push(a);
    s.invites = s.invites.filter((x) => x !== j.id);
    save(s);
    return ok({ application: { id: a.id, status: "applied", bidUgx: bid }, charged: 0 }, 201);
  }
  if (method === "GET" && p === "/applications/mine") {
    const mine = s.apps.filter((a) => a.workerId === ME).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ applications: mine.map((a) => { const j = s.jobs.find((x) => x.id === a.jobId)!; const c = s.contracts.find((x) => x.appId === a.id); return { id: a.id, jobId: a.jobId, jobTitle: j.title, jobType: j.type, jobStatus: j.status, area: j.area, status: a.status, bidUgx: a.bid, budgetMaxUgx: j.budgetMax, message: a.message, createdAt: a.createdAt, contractId: c?.id ?? null, contractStatus: c?.status ?? null }; }) });
  }
  if (method === "POST" && (r = m(/^\/applications\/([^/]+)\/withdraw$/))) { const a = s.apps.find((x) => x.id === r![1]); if (a) { a.status = "withdrawn"; save(s); } return ok({ ok: true }); }
  if (method === "GET" && (r = m(/^\/jobs\/([^/]+)\/applications$/))) {
    const rows = s.apps.filter((a) => a.jobId === r![1] && a.status !== "withdrawn" && a.workerId !== ME);
    return ok({ applicants: rows.map((a) => { const w = workerById(a.workerId)!; const c = s.contracts.find((x) => x.appId === a.id); const open = ["accepted", "hired"].includes(a.status) || s.unlocked.includes(w.id); return { id: a.id, status: a.status, message: a.message, bidUgx: a.bid, appliedAt: a.createdAt, contractId: c?.id ?? null, contractStatus: c?.status ?? null, worker: workerView(w, { phone: open }), phoneLocked: !open }; }) });
  }
  if (method === "POST" && (r = m(/^\/applications\/([^/]+)\/(shortlist|reject|hire|accept)$/))) {
    const a = s.apps.find((x) => x.id === r![1]);
    if (!a) return err(404, "not_found", "Not found");
    if (r[2] === "shortlist") a.status = "shortlisted";
    else if (r[2] === "reject") a.status = "rejected";
    else if (r[2] === "hire") { a.status = "hired"; const j = s.jobs.find((x) => x.id === a.jobId); if (j) j.status = "filled"; save(s); return ok({ ok: true, charged: 0, workerPhone: workerById(a.workerId)?.phone ?? "" }); }
    else return tryAccept(s, a, body.milestones);
    save(s);
    return ok({ ok: true });
  }
  if (method === "GET" && (r = m(/^\/applications\/([^/]+)\/messages$/))) return ok({ messages: s.messages[r[1]] ?? [] });
  if (method === "POST" && (r = m(/^\/applications\/([^/]+)\/messages$/))) {
    const msg = { id: uid("pmg"), mine: true, body: String(body.body ?? ""), createdAt: dbTime() };
    (s.messages[r[1]] ??= []).push(msg);
    (s.messages[r[1]]).push({ id: uid("pmg"), mine: false, body: "Thanks for the message. I'll get back to you shortly.", createdAt: dbTime(2000) });
    save(s);
    return ok({ message: msg }, 201);
  }

  // ---- contracts ----
  if (method === "GET" && p === "/contracts") {
    const role = q.get("role");
    return ok({ contracts: s.contracts.filter((c) => !role || (role === "worker" ? c.workerId === ME : c.employerId === ME)).map((c) => contractSummary(s, c)) });
  }
  if (method === "GET" && (r = m(/^\/contracts\/([^/]+)$/))) { const c = s.contracts.find((x) => x.id === r![1]); return c ? ok(contractDetail(s, c)) : err(404, "not_found", "Not found"); }
  if (method === "GET" && (r = m(/^\/contracts\/([^/]+)\/cancel-quote$/))) { const c = s.contracts.find((x) => x.id === r![1]); return c ? ok(cancelQuote(c)) : err(404, "not_found", "Not found"); }
  if (method === "POST" && (r = m(/^\/contracts\/([^/]+)(?:\/milestones\/([^/]+))?\/(submit|release)$/))) {
    const c = s.contracts.find((x) => x.id === r![1]);
    if (!c) return err(404, "not_found", "Not found");
    const ms = c.milestones.find((x: Json) => (r![2] ? x.id === r![2] : x.status === (r![3] === "submit" ? "pending" : "submitted") || (r![3] === "release" && x.status === "pending")));
    if (!ms) return err(400, "milestone_not_available", "That step can't be changed now.");
    if (r[3] === "submit") { ms.status = "submitted"; ms.note = body.note ?? null; ms.submittedAt = dbTime(); ms.confirmBy = dbTime(72 * 3_600_000); save(s); return ok({ ok: true, autoReleaseAt: ms.confirmBy }); }
    releaseMilestone(s, c, ms);
    save(s);
    return ok({ ok: true, settled: c.status === "settled" });
  }
  if (method === "POST" && (r = m(/^\/contracts\/([^/]+)\/cancel$/))) {
    const c = s.contracts.find((x) => x.id === r![1]);
    if (!c) return err(404, "not_found", "Not found");
    const quote = cancelQuote(c);
    if (quote.feeUgx > 0 && !body.acceptFee) return err(409, "late_cancel_fee", `Cancelling now costs ${ugx(quote.feeUgx)}. Confirm to go ahead.`, { feeUgx: quote.feeUgx });
    c.status = "cancelled"; c.cancelFee = quote.feeUgx;
    if (c.employerId === ME) s.wallet += Math.max(0, c.held - quote.feeUgx); else s.wallet -= quote.feeUgx;
    c.held = 0;
    const j = s.jobs.find((x) => x.id === c.jobId); if (j && j.status === "in_progress") j.status = "open";
    save(s);
    return ok({ ok: true, lateFeeUgx: quote.feeUgx, lateFeeStatus: quote.feeUgx ? "paid" : "none" });
  }
  if (method === "POST" && (r = m(/^\/contracts\/([^/]+)\/dispute$/))) { const c = s.contracts.find((x) => x.id === r![1]); if (c) { c.status = "disputed"; c.disputeReason = body.reason; save(s); } return ok({ ok: true }); }
  if (method === "POST" && (r = m(/^\/contracts\/([^/]+)\/review$/))) { s.reviews.push({ contractId: r[1], mine: true, rating: body.rating }); save(s); return ok({ ok: true }); }
  if (method === "POST" && (r = m(/^\/contracts\/([^/]+)\/repeat$/))) {
    const c = s.contracts.find((x) => x.id === r![1]);
    if (!c) return err(404, "not_found", "Not found");
    s.recurrences.push({ id: uid("pr"), kind: "rehire", sourceJobId: c.jobId, workerId: c.workerId, title: c.title, price: c.price, frequency: body.frequency, nextRunAt: addPeriod(dbTime(), body.frequency), maxRuns: body.maxRuns ?? 52, runsDone: 0, status: "active", lastError: null });
    save(s);
    return ok({ id: s.recurrences[s.recurrences.length - 1].id }, 201);
  }
  if (method === "GET" && p === "/recurrences") {
    return ok({ enabled: true, frequencies: ["weekly", "biweekly", "monthly"], recurrences: s.recurrences.filter((x) => x.status !== "ended").map((x) => ({ id: x.id, kind: x.kind, title: x.title, priceUgx: x.price, frequency: x.frequency, nextRunAt: x.nextRunAt, endsAt: null, maxRuns: x.maxRuns, runsDone: x.runsDone, status: x.status, lastError: x.lastError, sourceJobId: x.sourceJobId, worker: x.workerId ? { id: x.workerId, name: workerById(x.workerId)?.name ?? "" } : null, role: "employer" })) });
  }
  if (method === "POST" && (r = m(/^\/recurrences\/([^/]+)\/(pause|resume|end)$/))) { const x = s.recurrences.find((y) => y.id === r![1]); if (x) { x.status = r[2] === "pause" ? "paused" : r[2] === "resume" ? "active" : "ended"; save(s); } return ok({ ok: true }); }

  // ---- money, plans ----
  if (method === "GET" && p === "/earnings") {
    const held = s.contracts.filter((c) => c.employerId === ME).reduce((t, c) => t + (c.held ?? 0), 0);
    const upcoming = s.contracts.filter((c) => c.workerId === ME && c.status === "active").reduce((t, c) => t + c.milestones.filter((x: Json) => x.status !== "released").reduce((u: number, x: Json) => u + Math.round(x.amount * (1 - WORKER_FEE)), 0), 0);
    return ok({ worker: { paidUgx: s.earnedPaid, upcomingUgx: upcoming, contracts: s.contracts.filter((c) => c.workerId === ME).length }, employer: { heldInEscrowUgx: held, contracts: s.contracts.filter((c) => c.employerId === ME).length }, owedUgx: s.owed });
  }
  if (method === "POST" && p === "/pay-due") { s.owed = 0; save(s); return ok({ ok: true, paid: 0, stillOwed: 0 }); }
  if (method === "GET" && p === "/plans") return ok({ freeAccess: false, plans: PLANS.map((pl) => ({ ...pl, subscribed: s.subs.some((x) => x.code === pl.code && x.expiresAt > dbTime()), trialAvailable: !s.subs.some((x) => x.code === pl.code) })) });
  if (method === "GET" && p === "/membership") return ok(membership(s));
  if (method === "POST" && (r = m(/^\/plans\/([^/]+)\/subscribe$/))) {
    const pl = PLANS.find((x) => x.id === r![1] || x.code === r![1]);
    if (!pl) return err(404, "plan_not_found", "That plan isn't available.");
    const trial = !s.subs.some((x) => x.code === pl.code);
    s.subs.push({ id: uid("psb"), code: pl.code, name: pl.name, audience: pl.audience, trial, expiresAt: dbTime((trial ? pl.trialDays : pl.periodDays) * 86_400_000), autoRenew: true });
    if (!trial) s.wallet -= pl.priceUgx;
    save(s);
    return ok({ ok: true, trial, expiresAt: s.subs[s.subs.length - 1].expiresAt }, 201);
  }
  if (method === "POST" && (r = m(/^\/subscriptions\/([^/]+)\/cancel$/))) { const x = s.subs.find((y) => y.id === r![1]); if (x) { x.autoRenew = false; save(s); } return ok({ ok: true }); }
  if (method === "POST" && p === "/report") return ok({ ok: true });

  return err(404, "practice_unavailable", "That action isn't part of this practice scenario. Your live account was not changed.");
}
