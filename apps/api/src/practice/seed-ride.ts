import { PRACTICE_ENTEBBE } from "@peebee/shared/practice-entebbe";
import { type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/**
 * The Ride cluster's demo data: car owners and drivers with approved vehicles of every kind (saloons, minivans, luxury,
 * ambulances, cargo), cars to hire, carpool trips, owner-driver deals, and Taxipress routes with taxis in the queue.
 * Fleet rows carry no environment of their own, so they use `prac_` ids and live code hides them (see people.ts).
 */
const E = PRACTICE_ENTEBBE;
const at = (dLat: number, dLng: number) => ({ lat: E.lat + dLat, lng: E.lng + dLng });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString().replace("T", " ").slice(0, 19);
const NO_PASSWORD = "practice-account-no-password";

const user = (id: string, name: string, phone: string): DbStatement => ({
  sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at)
        VALUES (?, ?, ?, ?, 'customer', 'active', datetime('now'))`,
  args: [id, phone, name, NO_PASSWORD],
});

export const PRACTICE_OWNERS = [
  { id: "prac_owner_1", name: "Lakeview Van Hire" },
  { id: "prac_owner_2", name: "Entebbe Family Cars" },
  { id: "prac_owner_3", name: "Kitoro Movers" },
  { id: "prac_owner_4", name: "Entebbe Haulage Co." },
] as const;

type Driver = { n: string; name: string; make: string; model: string; plate: string; category: string; cls?: "convenient" | "comfort"; seats: number; owner: number; d: [number, number] };

export const PRACTICE_DRIVERS: readonly Driver[] = [
  { n: "01", name: "Daniel Kato", make: "Toyota", model: "Corolla", plate: "UBH 421K", category: "peebee-car-normal", cls: "convenient", seats: 4, owner: 1, d: [0.004, 0.002] },
  { n: "02", name: "Sarah Namusoke", make: "Honda", model: "Civic", plate: "UBJ 305P", category: "peebee-car-normal", cls: "comfort", seats: 4, owner: 1, d: [-0.003, 0.006] },
  { n: "03", name: "Peter Okello", make: "Toyota", model: "Noah", plate: "UAZ 778M", category: "peebee-car-large", cls: "convenient", seats: 7, owner: 1, d: [0.007, -0.004] },
  { n: "04", name: "Amina Nankya", make: "Toyota", model: "Voxy", plate: "UBF 112T", category: "peebee-car-large", cls: "comfort", seats: 7, owner: 1, d: [-0.006, -0.003] },
  { n: "05", name: "Mark Ssemanda", make: "Nissan", model: "Sylphy", plate: "UBK 690C", category: "peebee-car-normal", cls: "convenient", seats: 4, owner: 2, d: [0.001, -0.007] },
  { n: "06", name: "Joyce Akello", make: "Mazda", model: "Axela", plate: "UBG 254R", category: "peebee-car-normal", cls: "comfort", seats: 4, owner: 2, d: [0.009, 0.004] },
  { n: "07", name: "Isaac Mugisha", make: "Nissan", model: "Serena", plate: "UBL 843D", category: "peebee-car-large", cls: "convenient", seats: 7, owner: 2, d: [-0.009, 0.001] },
  { n: "08", name: "Ruth Atim", make: "Toyota", model: "Noah", plate: "UBE 377N", category: "peebee-car-large", cls: "comfort", seats: 7, owner: 2, d: [0.002, 0.009] },
  { n: "09", name: "James Kiggundu", make: "Mercedes-Benz", model: "S-Class", plate: "UBA 001L", category: "peebee-luxury-sedan", cls: "comfort", seats: 4, owner: 2, d: [0.003, 0.003] },
  { n: "10", name: "Brenda Nalwoga", make: "Range Rover", model: "Vogue", plate: "UBA 002L", category: "peebee-luxury-suv", cls: "comfort", seats: 6, owner: 2, d: [-0.002, 0.005] },
  { n: "11", name: "Charles Lubega", make: "Cadillac", model: "Stretch limousine", plate: "UBA 003L", category: "peebee-luxury-limo", cls: "comfort", seats: 8, owner: 2, d: [0.006, -0.006] },
  { n: "12", name: "Dr. Moses Opio", make: "Toyota", model: "HiAce Ambulance", plate: "UBA 999A", category: "peebee-ambulance-basic", cls: "comfort", seats: 2, owner: 4, d: [0.0, 0.004] },
  { n: "13", name: "Dr. Winnie Achan", make: "Mercedes-Benz", model: "Sprinter ICU", plate: "UBA 998A", category: "peebee-ambulance-icu", cls: "comfort", seats: 2, owner: 4, d: [-0.004, -0.001] },
  { n: "14", name: "Samuel Lwanga", make: "Toyota", model: "Hiace panel van", plate: "UBM 212V", category: "peebee-cargo-van", seats: 2, owner: 4, d: [0.005, -0.002] },
  { n: "15", name: "Paul Kyeyune", make: "Isuzu", model: "D-Max pickup", plate: "UBN 408P", category: "peebee-cargo-pickup", seats: 2, owner: 3, d: [-0.005, 0.007] },
  { n: "16", name: "George Mwesigwa", make: "Isuzu", model: "NPR box truck", plate: "UBP 631T", category: "peebee-cargo-truck-3t", seats: 2, owner: 3, d: [0.008, 0.001] },
  { n: "17", name: "Fred Tumusiime", make: "Hino", model: "500 heavy truck", plate: "UBQ 097H", category: "peebee-cargo-truck-7t", seats: 2, owner: 3, d: [-0.008, -0.005] },
];

/** Cars owners rent out to be driven by the renter (no driver). */
const RENTALS = [
  { n: "1", category: "demo-rent-sedan-cat", make: "Toyota", model: "Premio", year: 2018, colour: "Silver", plate: "UAX 301R", seats: 5, owner: 2, daily: 120_000, deposit: 60_000 },
  { n: "2", category: "demo-rent-noah-cat", make: "Toyota", model: "Noah", year: 2017, colour: "White", plate: "UAX 302R", seats: 7, owner: 2, daily: 160_000, deposit: 80_000 },
  { n: "3", category: "demo-rent-hiace-cat", make: "Toyota", model: "Hiace", year: 2019, colour: "White", plate: "UAX 303R", seats: 14, owner: 1, daily: 200_000, deposit: 100_000 },
  { n: "4", category: "demo-rent-suv-cat", make: "Nissan", model: "X-Trail", year: 2022, colour: "Blue", plate: "UAX 304R", seats: 5, owner: 2, daily: 180_000, deposit: 90_000 },
  { n: "5", category: "demo-rent-hatch-cat", make: "Suzuki", model: "Swift", year: 2020, colour: "Red", plate: "UAX 305R", seats: 5, owner: 1, daily: 90_000, deposit: 45_000 },
  { n: "6", category: "demo-rent-estate-cat", make: "Subaru", model: "Legacy Wagon", year: 2016, colour: "Grey", plate: "UAX 306R", seats: 5, owner: 1, daily: 110_000, deposit: 55_000 },
] as const;

const TRIPS = [
  { n: "1", driver: "01", from: ["Entebbe Town", 0.0612, 32.4637], to: ["Kampala (Garden City)", 0.3209, 32.5917], km: 38, inH: 3, price: 12_000 },
  { n: "2", driver: "03", from: ["Kitoro", 0.0558, 32.4692], to: ["Entebbe Airport", 0.0446, 32.4435], km: 6, inH: 1.5, price: 5_000 },
  { n: "3", driver: "05", from: ["Entebbe Town", 0.0612, 32.4637], to: ["Mukono", 0.3533, 32.7553], km: 52, inH: 6, price: 15_000 },
  { n: "4", driver: "07", from: ["Katabi", 0.0762, 32.4531], to: ["Kampala (Nakasero)", 0.3236, 32.5811], km: 36, inH: 26, price: 11_000 },
] as const;

export async function seedRide(): Promise<void> {
  const s: DbStatement[] = [];

  PRACTICE_OWNERS.forEach((o, i) => {
    s.push(user(o.id, o.name, `00000030${String(i + 1).padStart(2, "0")}`));
    s.push({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status, reviewed_at) VALUES (?, 'approved', 'none', datetime('now'))", args: [o.id] });
  });

  for (const d of PRACTICE_DRIVERS) {
    const id = `prac_cdrv_${d.n}`;
    const vehicleId = `prac_veh_${d.n}`;
    const owner = PRACTICE_OWNERS[d.owner - 1]!.id;
    const pos = at(d.d[0], d.d[1]);
    s.push(user(id, d.name, `00000031${d.n}`));
    s.push({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status, reviewed_at) VALUES (?, 'none', 'approved', datetime('now'))", args: [id] });
    s.push({
      sql: `INSERT OR IGNORE INTO vehicles (id, owner_id, category_id, plate, make, model, year, colour, status, reviewed_at, service_class, condition_grade, seat_capacity, features_json, accepts_convenient)
            VALUES (?, ?, ?, ?, ?, ?, 2020, 'White', 'approved', datetime('now'), ?, 'excellent', ?, '["Air conditioning","Bluetooth"]', 1)`,
      args: [vehicleId, owner, d.category, d.plate, d.make, d.model, d.cls ?? "convenient", d.seats],
    });
    s.push({ sql: "INSERT OR IGNORE INTO vehicle_assignments (id, vehicle_id, driver_id, status, assigned_by) VALUES (?, ?, ?, 'active', ?)", args: [`prac_asg_${d.n}`, vehicleId, id, owner] });
    s.push({ sql: "INSERT OR REPLACE INTO car_driver_state (driver_id, vehicle_id, online, lat, lng) VALUES (?, ?, 1, ?, ?)", args: [id, vehicleId, pos.lat, pos.lng] });
  }

  for (const r of RENTALS) {
    const vehicleId = `prac_rent_veh_${r.n}`;
    s.push({
      sql: `INSERT OR IGNORE INTO vehicles (id, owner_id, category_id, plate, make, model, year, colour, status, reviewed_at, service_class, condition_grade, seat_capacity, features_json, accepts_convenient)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', datetime('now'), 'convenient', 'good', ?, '["Air conditioning"]', 1)`,
      args: [vehicleId, PRACTICE_OWNERS[r.owner - 1]!.id, r.category, r.plate, r.make, r.model, r.year, r.colour, r.seats],
    });
    s.push({
      sql: `INSERT OR IGNORE INTO rental_listings (vehicle_id, daily_price, deposit_amount, notes, active, hourly_enabled, half_day_enabled, full_day_enabled, environment)
            VALUES (?, ?, ?, ?, 1, 1, 1, 1, 'sandbox')`,
      args: [vehicleId, r.daily, r.deposit, `${PRACTICE_OWNERS[r.owner - 1]!.name} · Entebbe pickup`],
    });
  }

  // Two customers are approved to hire and drive; one has a finished hire and one is out on the road.
  PRACTICE_CUSTOMERS.slice(0, 2).forEach((c, i) => s.push({
    sql: `INSERT OR IGNORE INTO selfdrive_renter_kyc (user_id, nin, residential_address, national_id_key, residence_method, status, reviewed_at)
          VALUES (?, ?, ?, 'practice/national-id.jpg', 'bill', 'approved', datetime('now'))`,
    args: [c.id, `CM9000${i}0000000`, c.areaAddress],
  }));
  const rental = (id: string, vehicle: (typeof RENTALS)[number], renter: string, status: "completed" | "active", fromDays: number, days: number) => ({
    sql: `INSERT OR IGNORE INTO rentals (id, vehicle_id, owner_id, renter_id, starts_at, ends_at, days, daily_price, rent_amount, deposit_amount, platform_percent, licence_number, licence_expiry,
                                          status, handed_over_at, returned_at, settled_at, owner_amount, platform_amount, refund_amount, environment, period_type)
          VALUES (?, ?, ?, ?, datetime('now', ?), datetime('now', ?), ?, ?, ?, ?, 15, 'UG-DL-PRACTICE', '2030-01-01', ?, datetime('now', ?), ${status === "completed" ? "datetime('now', ?)" : "NULL"}, ${status === "completed" ? "datetime('now', ?)" : "NULL"}, ?, ?, ?, 'sandbox', 'full_day')`,
    args: [id, `prac_rent_veh_${vehicle.n}`, PRACTICE_OWNERS[vehicle.owner - 1]!.id, renter, `${fromDays} days`, `${fromDays + days} days`, days, vehicle.daily, vehicle.daily * days, vehicle.deposit, status, `${fromDays} days`,
      ...(status === "completed" ? [`${fromDays + days} days`, `${fromDays + days} days`] : []), status === "completed" ? Math.round(vehicle.daily * days * 0.85) : null, status === "completed" ? Math.round(vehicle.daily * days * 0.15) : null, status === "completed" ? vehicle.deposit : null],
  });
  s.push(rental("prac_rental_done", RENTALS[0], PRACTICE_CUSTOMERS[0]!.id, "completed", -12, 2));
  s.push(rental("prac_rental_active", RENTALS[3], PRACTICE_CUSTOMERS[1]!.id, "active", -1, 3));

  for (const t of TRIPS) {
    const d = PRACTICE_DRIVERS.find((x) => x.n === t.driver)!;
    s.push({
      sql: `INSERT OR IGNORE INTO carpool_trips (id, driver_id, vehicle_id, category_id, origin_label, origin_lat, origin_lng, dest_label, dest_lat, dest_lng, distance_km, depart_at, seats_total, seats_taken,
                                                 seat_price, status, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'open', 'sandbox')`,
      args: [`prac_trip_${t.n}`, `prac_cdrv_${d.n}`, `prac_veh_${d.n}`, d.category, t.from[0], t.from[1], t.from[2], t.to[0], t.to[1], t.to[2], t.km, inHours(t.inH), Math.max(1, d.seats - 1), t.price],
    });
  }

  // Owner-driver deals: two cars are open to drivers (one on a profit share, one on weekly rent); two drivers without a car
  // have applied; one driver already works a car on rent.
  s.push({ sql: "INSERT OR IGNORE INTO vehicle_terms (vehicle_id, open_to_drivers, fee_type, owner_share_percent, notes) VALUES ('prac_rent_veh_5', 1, 'share', 60, 'Share of what the car earns after Peebee''s cut')", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO vehicle_terms (vehicle_id, open_to_drivers, fee_type, rent_amount, rent_period, notes) VALUES ('prac_rent_veh_6', 1, 'rent', 350000, 'week', 'Weekly rent, you keep the fares')", args: [] });
  for (const [n, name] of [["91", "Hassan Ssekyewa"], ["92", "Esther Namatovu"]] as const) {
    s.push(user(`prac_cdrv_${n}`, name, `00000031${n}`));
    s.push({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status, needs_vehicle, reviewed_at) VALUES (?, 'none', 'approved', 1, datetime('now'))", args: [`prac_cdrv_${n}`] });
  }
  s.push({ sql: `INSERT OR IGNORE INTO driver_requests (id, vehicle_id, driver_id, owner_id, status, fee_type, owner_share_percent) VALUES ('prac_deal_req_1', 'prac_rent_veh_5', 'prac_cdrv_91', ?, 'pending', 'share', 60)`, args: [PRACTICE_OWNERS[0].id] });
  s.push({ sql: `INSERT OR IGNORE INTO driver_requests (id, vehicle_id, driver_id, owner_id, status, fee_type, rent_amount, rent_period) VALUES ('prac_deal_req_2', 'prac_rent_veh_6', 'prac_cdrv_92', ?, 'pending', 'rent', 350000, 'week')`, args: [PRACTICE_OWNERS[0].id] });
  s.push({ sql: `UPDATE vehicle_assignments SET fee_type = 'share', owner_share_percent = 60 WHERE id = 'prac_asg_01'`, args: [] });
  s.push({ sql: `UPDATE vehicle_assignments SET fee_type = 'rent', rent_amount = 280000, rent_period = 'week' WHERE id = 'prac_asg_05'`, args: [] });

  // Taxipress: shared-taxi routes out of Entebbe and across Kampala, each with taxis in the line.
  const OLD_TAXI_PARK = ["Kampala Old Taxi Park", 0.3136, 32.5775] as const;
  const routes = [
    { id: "prac_rr_kampala", name: "Entebbe ⇄ Kampala (Old Taxi Park)", a: ["Entebbe Taxi Park", 0.0577, 32.4627, "PRA"], b: ["Kampala Old Taxi Park", 0.3136, 32.5775, "PRB"], fare: 7_000, parcel: 10_000 },
    { id: "prac_rr_masaka", name: "Entebbe ⇄ Masaka", a: ["Entebbe Taxi Park", 0.0577, 32.4627, "PRC"], b: ["Masaka Bus Park", -0.3355, 31.7366, "PRD"], fare: 22_000, parcel: 25_000 },
    { id: "prac_rr_mukono", name: "Kampala ⇄ Mukono", a: [...OLD_TAXI_PARK, "PRE"], b: ["Mukono Taxi Park", 0.3533, 32.7553, "PRF"], fare: 5_000, parcel: 8_000 },
    { id: "prac_rr_ntinda", name: "Kampala ⇄ Ntinda", a: [...OLD_TAXI_PARK, "PRG"], b: ["Ntinda Stage", 0.3540, 32.6155, "PRH"], fare: 3_000, parcel: 5_000 },
    { id: "prac_rr_naalya", name: "Kampala ⇄ Naalya", a: [...OLD_TAXI_PARK, "PRI"], b: ["Naalya Stage", 0.3817, 32.6544, "PRJ"], fare: 4_000, parcel: 6_000 },
    { id: "prac_rr_busega_naalya", name: "Busega ⇄ Naalya", a: ["Busega Roundabout", 0.3139, 32.5409, "PRK"], b: ["Naalya Stage", 0.3817, 32.6544, "PRL"], fare: 5_000, parcel: 7_000 },
  ] as const;
  // Stops between the ends, so passengers can get on and off along the way.
  const ROUTE_STOPS: Record<string, ReadonlyArray<readonly [string, number, number]>> = {
    prac_rr_mukono: [["Banda", 0.3447, 32.6563], ["Seeta", 0.3586, 32.7177]],
    prac_rr_ntinda: [["Kisaasi", 0.3727, 32.6013]],
    prac_rr_naalya: [["Ntinda", 0.3540, 32.6155], ["Kyaliwajjala", 0.3814, 32.6325]],
    prac_rr_busega_naalya: [["Wandegeya", 0.3322, 32.5692], ["Ntinda", 0.3540, 32.6155]],
  };
  for (const r of routes) {
    s.push({
      sql: `INSERT OR IGNORE INTO relay_routes (id, name, stage_a_name, stage_a_lat, stage_a_lng, stage_b_name, stage_b_lat, stage_b_lng, parcel_fare, active, stage_a_code, stage_b_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [r.id, r.name, r.a[0], r.a[1], r.a[2], r.b[0], r.b[1], r.b[2], r.parcel, r.a[3], r.b[3]],
    });
    (["a_to_b", "b_to_a"] as const).forEach((dir, i) => s.push({
      sql: "INSERT OR IGNORE INTO taxipress_routes (id, relay_route_id, direction, fare_per_seat, active, sort) VALUES (?, ?, ?, ?, 1, ?)",
      args: [`${r.id}_${dir}`, r.id, dir, r.fare, i],
    }));
  }
  for (const [route, list] of Object.entries(ROUTE_STOPS)) {
    list.forEach(([name, lat, lng], i) => s.push({
      sql: "INSERT OR IGNORE INTO relay_route_stages (id, route_id, seq, name, lat, lng, outlet_id, active) VALUES (?, ?, ?, ?, ?, ?, NULL, 1)",
      args: [`${route}_stage_${i + 1}`, route, i + 1, name, lat, lng],
    }));
  }
  const taxis = [
    { n: "1", name: "Moses Wasswa", plate: "UBR 110T", layout: "14", route: routes[0].id, state: "boarding", booked: 0 },
    { n: "2", name: "Robert Mukisa", plate: "UBR 111T", layout: "14", route: routes[0].id, state: "in_line", booked: 0 },
    { n: "3", name: "Simon Ochieng", plate: "UBR 112T", layout: "18", route: routes[0].id, state: "in_line", booked: 0 },
    { n: "4", name: "Patrick Lutaaya", plate: "UBR 113T", layout: "14", route: routes[1].id, state: "boarding", booked: 0 },
    { n: "5", name: "Vincent Kayiwa", plate: "UBR 114T", layout: "18", route: routes[1].id, state: "in_line", booked: 0 },
    { n: "6", name: "Tom Ssentamu", plate: "UBR 115T", layout: "14", route: routes[2].id, state: "boarding", booked: 0 },
    { n: "7", name: "Emmanuel Byaruhanga", plate: "UBR 116T", layout: "14", route: routes[2].id, state: "in_line", booked: 0 },
    { n: "8", name: "Gerald Mbabazi", plate: "UBR 117T", layout: "18", route: routes[3].id, state: "boarding", booked: 0 },
    { n: "9", name: "Hakim Lutalo", plate: "UBR 118T", layout: "14", route: routes[3].id, state: "in_line", booked: 0 },
    { n: "10", name: "Vicky Nabukenya", plate: "UBR 119T", layout: "14", route: routes[4].id, state: "boarding", booked: 0 },
    { n: "11", name: "Dennis Opolot", plate: "UBR 120T", layout: "18", route: routes[4].id, state: "in_line", booked: 0 },
    { n: "12", name: "Yusuf Kasule", plate: "UBR 121T", layout: "14", route: routes[5].id, state: "boarding", booked: 0 },
    { n: "13", name: "Martin Kawooya", plate: "UBR 122T", layout: "14", route: routes[5].id, state: "in_line", booked: 0 },
  ] as const;
  for (const t of taxis) {
    const id = `prac_tx_${t.n}`;
    s.push(user(id, t.name, `00000032${t.n}`));
    s.push({
      sql: `INSERT OR IGNORE INTO taxipress_taxis (id, user_id, relay_route_id, plate, seat_layout, seats, status, approved_at) VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`,
      args: [`prac_taxi_${t.n}`, id, t.route, t.plate, t.layout, Number(t.layout)],
    });
    s.push({
      sql: `INSERT OR IGNORE INTO taxipress_queue (id, taxipress_route_id, taxi_id, driver_id, status, seats_total, seats_booked, boarding_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ${t.state === "boarding" ? "datetime('now')" : "NULL"})`,
      args: [`prac_q_${t.n}`, `${t.route}_a_to_b`, `prac_taxi_${t.n}`, id, t.state, Number(t.layout)],
    });
  }

  // Boda stages: each rider belongs to the stage they wait at, with a chairman and the rest as members.
  const stages = [
    { id: "prac_stage_kitoro", name: "Kitoro Stage", area: "Kitoro", riders: [1, 5] },
    { id: "prac_stage_town", name: "Entebbe Town Stage", area: "Entebbe Town", riders: [2] },
    { id: "prac_stage_bugonga", name: "Bugonga Stage", area: "Bugonga", riders: [3] },
    { id: "prac_stage_katabi", name: "Katabi Stage", area: "Katabi", riders: [4] },
    { id: "prac_stage_lunyo", name: "Lunyo Stage", area: "Lunyo", riders: [6] },
  ] as const;
  for (const st of stages) {
    s.push({ sql: "INSERT OR IGNORE INTO stages (id, name, area, address, description, status, approval_status, reviewed_at) VALUES (?, ?, ?, ?, 'Practice boda stage', 'active', 'approved', datetime('now'))", args: [st.id, st.name, st.area, `${st.name}, Entebbe`] });
    st.riders.forEach((n, i) => {
      s.push({ sql: "INSERT OR IGNORE INTO stage_members (id, stage_id, rider_id, role) VALUES (?, ?, ?, ?)", args: [`prac_sm_${st.id}_${n}`, st.id, `prac_rider_${n}`, i === 0 ? "chairman" : "member"] });
      s.push({ sql: "UPDATE riders SET stage_id = ? WHERE user_id = ? AND stage_id IS NULL", args: [st.id, `prac_rider_${n}`] });
    });
  }

  await runSeed(s);
}
