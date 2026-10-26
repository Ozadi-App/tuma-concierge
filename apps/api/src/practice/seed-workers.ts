import { type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";

/**
 * Entebbe's own workers for Peebee Hire: tradespeople, helpers and professionals a customer can look up, invite to a job
 * and hire. Together with the shared sample workers they cover every kind of work on the platform. Each answers the jobs
 * practising customers post (see demo-workers.ts).
 */
const NO_PASSWORD = "practice-account-no-password";

type Worker = { n: string; name: string; headline: string; bio: string; skills: string[]; categories: string[]; area: string; lat: number; lng: number; rateType: "hour" | "day" | "job"; rate: number; years: number; verified: boolean; rating: number; reviews: number; done: number; remote?: boolean };

export const PRACTICE_WORKERS: readonly Worker[] = [
  { n: "plumber", name: "Ronald Ssekandi", headline: "Plumber: leaks, taps, tanks and bathroom fittings", bio: "Fast, tidy plumbing for homes and guest houses around Entebbe. I bring my own tools and fittings.", skills: ["plumbing", "water tanks", "bathrooms"], categories: ["tcat_repairs", "tcat_construction"], area: "Kitoro", lat: 0.0558, lng: 32.4692, rateType: "job", rate: 60_000, years: 9, verified: true, rating: 4.8, reviews: 31, done: 44 },
  { n: "electrician", name: "Isaac Wamala", headline: "Electrician: wiring, sockets, solar and fault finding", bio: "Licensed electrician. House wiring, prepaid meter connections and solar lighting kits.", skills: ["electrical", "solar", "wiring"], categories: ["tcat_repairs", "tcat_engineering"], area: "Bugonga", lat: 0.0497, lng: 32.4574, rateType: "job", rate: 80_000, years: 7, verified: true, rating: 4.7, reviews: 22, done: 30 },
  { n: "cleaner", name: "Prossy Namutebi", headline: "Home and office cleaner, regular or one-off", bio: "Weekly cleaning, move-out cleans and laundry. References from three guest houses.", skills: ["cleaning", "laundry", "ironing"], categories: ["tcat_cleaning"], area: "Katabi", lat: 0.0762, lng: 32.4531, rateType: "day", rate: 35_000, years: 5, verified: true, rating: 4.9, reviews: 40, done: 58 },
  { n: "painter", name: "Hassan Mukasa", headline: "Painter and finisher", bio: "Interior and exterior painting, plastering touch-ups and ceiling boards. Free quotes.", skills: ["painting", "plastering"], categories: ["tcat_construction"], area: "Nakiwogo", lat: 0.0468, lng: 32.4709, rateType: "day", rate: 50_000, years: 11, verified: false, rating: 4.5, reviews: 17, done: 25 },
  { n: "tailor", name: "Joan Akello", headline: "Tailor: uniforms, dresses and alterations", bio: "School uniforms, kitenge dresses, suits and alterations. Orders ready in a week.", skills: ["tailoring", "alterations", "kitenge"], categories: ["tcat_beauty"], area: "Entebbe Town", lat: 0.0612, lng: 32.4637, rateType: "job", rate: 45_000, years: 8, verified: true, rating: 4.8, reviews: 26, done: 37 },
  { n: "driver", name: "Fred Tumwine", headline: "Driver with own licence for airport runs and day hire", bio: "Class B licence, clean record. Airport transfers, errands and long-distance driving.", skills: ["driving", "airport transfers"], categories: ["tcat_driving"], area: "Entebbe Airport", lat: 0.0446, lng: 32.4435, rateType: "day", rate: 90_000, years: 10, verified: true, rating: 4.6, reviews: 19, done: 28 },
  { n: "tutor", name: "Dorothy Nankya", headline: "Primary and secondary maths and science tutor", bio: "Degree in education. After-school and weekend lessons, exam preparation, home or online.", skills: ["maths", "science", "exam prep"], categories: ["tcat_education"], area: "Lunyo", lat: 0.0364, lng: 32.4816, rateType: "hour", rate: 20_000, years: 6, verified: true, rating: 4.9, reviews: 33, done: 52, remote: true },
  { n: "gardener", name: "Samuel Kiwanuka", headline: "Gardener and compound care", bio: "Lawn cutting, hedges, planting and compound clean-ups. Weekly or monthly.", skills: ["gardening", "lawn care", "landscaping"], categories: ["tcat_farm"], area: "Abaita Ababiri", lat: 0.0412, lng: 32.4423, rateType: "day", rate: 30_000, years: 12, verified: false, rating: 4.4, reviews: 11, done: 19 },
  { n: "caterer", name: "Betty Nalwoga", headline: "Caterer for weddings, meetings and parties", bio: "Buffets for 20 to 300 guests, with serving staff. Local and continental menus.", skills: ["catering", "buffet", "events"], categories: ["tcat_events"], area: "Kitoro", lat: 0.0571, lng: 32.4668, rateType: "job", rate: 400_000, years: 9, verified: true, rating: 4.8, reviews: 28, done: 41 },
  { n: "mechanic", name: "Charles Okumu", headline: "Mobile mechanic for cars and motorcycles", bio: "Servicing, brakes, batteries and breakdowns. I come to you anywhere in Entebbe.", skills: ["mechanic", "car servicing", "motorcycle repair"], categories: ["tcat_repairs", "tcat_driving"], area: "Bugonga", lat: 0.0489, lng: 32.4586, rateType: "job", rate: 70_000, years: 13, verified: true, rating: 4.7, reviews: 36, done: 63 },
  { n: "carer", name: "Agnes Tendo", headline: "Home carer and nanny", bio: "Experienced with babies and the elderly. First-aid trained. Day or live-in.", skills: ["childcare", "elder care", "first aid"], categories: ["tcat_security"], area: "Katabi", lat: 0.0755, lng: 32.4549, rateType: "day", rate: 40_000, years: 7, verified: true, rating: 4.9, reviews: 21, done: 34 },
  { n: "developer", name: "Brian Lubwama", headline: "Web developer for small business sites and shops", bio: "Fast websites, online shops and mobile money integrations. Remote, based in Entebbe.", skills: ["web design", "react", "online shops"], categories: ["tcat_tech", "tcat_design"], area: "Entebbe Town", lat: 0.0605, lng: 32.4651, rateType: "job", rate: 600_000, years: 6, verified: true, rating: 4.7, reviews: 15, done: 21, remote: true },
  { n: "photographer", name: "Maria Nakitende", headline: "Photographer and video for events", bio: "Weddings, graduations and product shots. Edited photos in three days.", skills: ["photography", "video", "editing"], categories: ["tcat_design", "tcat_events"], area: "Kitoro", lat: 0.0549, lng: 32.4703, rateType: "job", rate: 350_000, years: 5, verified: true, rating: 4.8, reviews: 18, done: 27 },
  { n: "builder", name: "Paul Oyoo", headline: "Mason and builder with a small crew", bio: "Foundations, walls, floors and fences. Free site visits and written quotes.", skills: ["masonry", "bricklaying", "fencing"], categories: ["tcat_construction"], area: "Nakiwogo", lat: 0.0452, lng: 32.4725, rateType: "day", rate: 70_000, years: 15, verified: true, rating: 4.6, reviews: 29, done: 46 },
];

export const PRACTICE_WORKER_IDS = PRACTICE_WORKERS.map((w) => `prac_wk_${w.n}`);

export async function seedWorkers(): Promise<void> {
  const s: DbStatement[] = [];
  PRACTICE_WORKERS.forEach((w, i) => {
    const id = `prac_wk_${w.n}`;
    s.push({
      sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at) VALUES (?, ?, ?, ?, 'customer', 'active', datetime('now'))`,
      args: [id, `00000085${String(i + 1).padStart(2, "0")}`, w.name, NO_PASSWORD],
    });
    s.push({
      sql: `INSERT OR IGNORE INTO talent_profiles (user_id, headline, bio, skills, languages, area, lat, lng, radius_km, remote, rate_type, rate_ugx, experience_years, availability, visible, status,
              id_verified, activated_at, rating_sum, rating_count, jobs_completed, environment)
            VALUES (?, ?, ?, ?, '["English","Luganda"]', ?, ?, ?, 20, ?, ?, ?, ?, 'available', 1, 'approved', ?, datetime('now'), ?, ?, ?, 'sandbox')`,
      args: [id, w.headline, w.bio, JSON.stringify(w.skills), w.area, w.lat, w.lng, w.remote ? 1 : 0, w.rateType, w.rate, w.years, w.verified ? 1 : 0, Math.round(w.rating * w.reviews), w.reviews, w.done],
    });
    for (const c of w.categories) s.push({ sql: "INSERT OR IGNORE INTO talent_profile_categories (user_id, category_id) VALUES (?, ?)", args: [id, c] });
  });
  await runSeed(s);
}
