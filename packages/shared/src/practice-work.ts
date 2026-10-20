/**
 * Hive (Peebee Work: Clean, Laundry, Fix) in practice mode: a browser-local
 * stand-in for /v1/work. It serves the real seeded catalogue and prices,
 * sample nearby-provider pins, and keeps practice bookings in localStorage.
 * Nothing here books a real provider, holds real money or contacts anyone.
 */

type Json = Record<string, any>;
const KEY = "peebee_practice_work_v1";
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const err = (status: number, error: string, message: string) => ok({ error, message }, status);
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

type Svc = [id: string, type: "clean" | "laundry" | "fix", category: string, name: string, description: string, mode: "fixed" | "quote", unit: string, price: number, callout: number, max?: number];
/** Same ids, names and prices as the seeded catalogue (migrations 0098/0099). */
export const PRACTICE_WORK_SERVICES: Svc[] = [
  ["wsv_clean_house_standard", "clean", "house", "Standard home clean", "Dusting, floors, kitchen and bathrooms, per bedroom", "fixed", "bedroom", 35000, 0, 10],
  ["wsv_clean_house_deep", "clean", "house", "Deep home clean", "Top-to-bottom clean including appliances and windows, per bedroom", "fixed", "bedroom", 60000, 0, 10],
  ["wsv_clean_move", "clean", "house", "Move-in / move-out clean", "Empty home, priced after the provider looks", "quote", "job", 0, 10000],
  ["wsv_clean_office", "clean", "office", "Office clean", "Desks, floors, kitchenette and washrooms", "fixed", "50 m² block", 80000, 0, 20],
  ["wsv_clean_car_wash", "clean", "vehicle", "Car wash (inside and out)", "At your home or office", "fixed", "car", 25000, 0, 5],
  ["wsv_clean_sofa", "clean", "upholstery", "Sofa / upholstery cleaning", "Shampoo and extraction", "fixed", "seat", 15000, 0, 12],
  ["wsv_laundry_wash_kg", "laundry", "wash_fold", "Everyday clothes, wash and fold", "Washed, tumble dried and folded, per kg", "fixed", "kg", 5000, 0, 30],
  ["wsv_laundry_wash_bag", "laundry", "wash_fold", "Full laundry bag (about 6 kg)", "Washed, dried and folded", "fixed", "bag", 25000, 0, 5],
  ["wsv_laundry_suit", "laundry", "dry_clean", "2-piece suit", "Solvent clean and steam press", "fixed", "suit", 18000, 0, 10],
  ["wsv_laundry_duvet_single", "laundry", "bulky", "Single or medium duvet", "Deep wash and high-heat dry", "fixed", "piece", 20000, 0, 6],
  ["wsv_fix_plumbing", "fix", "plumbing", "Plumbing repair", "Leaking pipe, tap, clogged sink or toilet; priced after the provider looks", "quote", "job", 0, 20000],
  ["wsv_fix_electrical", "fix", "electrical", "Electrical repair", "Socket fault, breaker, lighting or short circuit; priced after the provider looks", "quote", "job", 0, 25000],
  ["wsv_fix_appliance", "fix", "appliances", "Appliance repair", "Fridge, washing machine, microwave or stove; priced after the provider looks", "quote", "job", 0, 30000],
  ["wsv_fix_tap_replace", "fix", "plumbing", "Tap replacement (labour)", "Fit a tap you have bought", "fixed", "tap", 25000, 0, 6],
  ["wsv_fix_socket_replace", "fix", "electrical", "Socket or switch replacement (labour)", "Replace a socket or switch", "fixed", "point", 15000, 0, 10],
];

const service = (s: Svc) => ({
  id: s[0], type: s[1], category: s[2], name: s[3], description: s[4], pricingMode: s[5], unitLabel: s[6],
  unitPriceUgx: s[7], calloutFeeUgx: s[8], minQuantity: 1, maxQuantity: s[9] ?? 1,
});

const SETTINGS = {
  enabled: true, serviceTypes: ["clean", "laundry", "fix"], pricingModes: ["fixed", "quote"], matchingModes: ["broadcast", "customer_picks", "admin_assigns"],
  defaultMatching: "broadcast", photosEnabled: true, maxPhotosPerJob: 6, maxPhotoKb: 900, chatEnabled: true, trackingEnabled: true,
  quoteValidHours: 24, freeCancelMinutes: 10, lateCancelFeePercent: 20, autoConfirmHours: 24, disputeWindowHours: 48, minLeadMinutes: 60, maxAdvanceDays: 14,
};

/** Sample pins: offsets in ~cells from the customer, by trade. Coarse on purpose, like the live endpoint. */
const PIN_OFFSETS: Array<["clean" | "laundry" | "fix", number, number]> = [
  ["clean", -0.006, -0.009], ["clean", 0.008, 0.006], ["clean", -0.011, 0.004], ["clean", 0.004, -0.013],
  ["laundry", 0.010, -0.004], ["laundry", -0.004, 0.012],
  ["fix", 0.013, 0.010], ["fix", -0.009, -0.002],
];

type State = { jobs: Json[] };
function load(): State {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "") as State; } catch { return { jobs: [] }; }
}
function save(s: State) { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } }

const PROVIDER = { id: "practice-provider", kind: "individual", name: "Ruth N. (practice)", bio: "Sample provider for practice mode.", rating: 4.9, ratingCount: 128, jobsCompleted: 312 };

/** Moves a practice job along on its own so the live card and tracking can be tried. */
function advance(job: Json): Json {
  if (job.status !== "open") return job;
  const age = Date.now() - new Date(job.createdAt).getTime();
  if (age < 8000) return job;
  const assigned: Json = {
    ...job, status: job.pricingMode === "quote" ? "quoted" : "booked", provider: PROVIDER, assignedAt: iso(),
    providerLocation: job.lat != null ? { lat: job.lat + 0.006, lng: job.lng - 0.004, updatedAt: iso() } : null,
  };
  if (job.pricingMode === "quote") { assigned.priceUgx = job.calloutFeeUgx + 25000; assigned.quoteExpiresAt = iso(24 * 3600_000); }
  return assigned;
}
function actionsFor(job: Json): string[] {
  if (job.status === "open") return ["cancel"];
  if (job.status === "quoted") return ["accept_quote", "decline_quote", "cancel"];
  if (job.status === "booked" || job.status === "in_progress") return ["cancel", "report_problem"];
  if (job.status === "completed") return ["confirm", "report_problem"];
  if (job.status === "settled" && job.rating == null) return ["rate"];
  return [];
}

export function practiceWorkRequest(path: string, method: string, body: Json, query: URLSearchParams): Response {
  if (method === "GET" && path === "/v1/work/catalog") {
    const type = query.get("type");
    return ok({ services: PRACTICE_WORK_SERVICES.filter((s) => !type || s[1] === type).map(service), settings: SETTINGS });
  }
  if (method === "GET" && path === "/v1/work/nearby") {
    const lat = Number(query.get("lat")), lng = Number(query.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ok({ radiusKm: 10, total: 0, counts: { clean: 0, laundry: 0, fix: 0 }, pins: [] });
    const pins = PIN_OFFSETS.map(([type, dy, dx]) => ({ type, lat: Math.round((lat + dy) * 1e5) / 1e5, lng: Math.round((lng + dx) * 1e5) / 1e5 }));
    return ok({ radiusKm: 10, total: 16, counts: { clean: 9, laundry: 3, fix: 4 }, pins, practice: true });
  }

  const state = load();
  state.jobs = state.jobs.map(advance);
  save(state);

  if (method === "GET" && path === "/v1/work/jobs") return ok({ jobs: [...state.jobs].reverse().map((j) => ({ ...j, actions: actionsFor(j) })) });

  if (method === "POST" && path === "/v1/work/jobs") {
    const s = PRACTICE_WORK_SERVICES.find((x) => x[0] === body.serviceId);
    if (!s) return err(400, "unknown_service", "Choose a service.");
    const qty = Math.max(1, Number(body.quantity) || 1);
    const price = s[5] === "fixed" ? s[7] * qty : s[8];
    const job = {
      id: `practice-work-${Date.now().toString(36)}`, status: "open", customer: null, service: { id: s[0], type: s[1], name: s[3] },
      pricingMode: s[5], matchingMode: body.matchingMode ?? "broadcast", quantity: qty, details: String(body.details ?? ""),
      address: String(body.address ?? "Practice address"), area: body.area ?? null, lat: body.lat ?? null, lng: body.lng ?? null,
      scheduledFor: body.scheduledFor ?? null, unitPriceUgx: s[7], calloutFeeUgx: s[8], priceUgx: price, heldUgx: price,
      commissionPercent: 0, commissionUgx: 0, expiresAt: iso(30 * 60_000), quoteExpiresAt: null, confirmBy: null, provider: null, workerName: null,
      rating: null, review: null, cancelReason: null, cancelledBy: null, disputeReason: null, resolutionNote: null,
      createdAt: iso(), assignedAt: null, startedAt: null, completedAt: null, settledAt: null, practice: true,
    };
    state.jobs.push(job);
    save(state);
    return ok({ job, actions: actionsFor(job) }, 201);
  }

  const m = /^\/v1\/work\/jobs\/([^/]+)(?:\/(.+))?$/.exec(path);
  if (m) {
    const job = state.jobs.find((j) => j.id === decodeURIComponent(m[1]!));
    if (!job) return err(404, "not_found", "Job not found");
    const sub = m[2] ?? "";
    const update = (patch: Json) => { Object.assign(job, patch); save(state); return ok({ ok: true, job }); };
    if (method === "GET" && sub === "") return ok({ job, actions: actionsFor(job), offers: [], timeline: [{ action: "booked", actor_kind: "customer", created_at: job.createdAt }] });
    if (method === "GET" && (sub === "photos")) return ok({ photos: [] });
    if (method === "GET" && sub.startsWith("messages")) return ok({ messages: [] });
    if (method === "POST" && sub === "cancel") return update({ status: "cancelled", cancelledBy: "customer", cancelReason: body.reason ?? null });
    if (method === "POST" && sub === "quote/accept") return update({ status: "booked", heldUgx: job.priceUgx });
    if (method === "POST" && sub === "quote/decline") return update({ status: "cancelled", cancelledBy: "customer" });
    if (method === "POST" && sub === "confirm") return update({ status: "settled", settledAt: iso() });
    if (method === "POST" && sub === "dispute") return update({ status: "disputed", disputeReason: body.reason ?? "" });
    if (method === "POST" && sub === "rate") return update({ rating: Number(body.rating) || null, review: body.review ?? null });
    if (method === "POST" && sub === "messages") return ok({ message: { id: `pm-${Date.now()}`, from: "customer", body: String(body.body ?? ""), createdAt: iso() } });
  }
  return err(400, "practice_unsupported", "That action is outside this practice scenario. Your live account was not changed.");
}

export function resetPracticeWork() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
