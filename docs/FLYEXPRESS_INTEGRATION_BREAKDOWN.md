# Fly Express → Peebee "Taxi" — feature breakdown and recommendations

Status: **Draft for your decisions. No code written.**
Source studied: `xristo7/flyexpress` at `444a361` (static demo: `index.html`, `script.js` ~7,800 lines, `styles.css`, `PROJECT-GUIDE.md`, `design-qa.md`, and the *Modules & Revenue Specification* PDF).
Target studied: Peebee `apps/customer` Ride home (`components/ride/RideHome.tsx`), `BottomNav.tsx`, `ServiceLanding.tsx`, admin `settings/home-menu`, and the car/relay/wallet code.

Legend: **[V]** verified in the code · **[A]** my assumption · **[?]** needs your decision.

---

## 1. What Fly Express actually is (this changes the plan)

Fly Express is **not an Uber-style "request a car now" app.** It is a **scheduled, shared-van service on fixed corridors**, like a Ugandan taxi/matatu park moved into an app:

- Fixed stages and corridors (Entebbe Bus Park ↔ Kampala Railway Stage via Kajjansi or Busega; Nambole, Masaka, Lyantonde, Mbarara). **[V]**
- A **timetable of departures** every 30 minutes, each with a vehicle, plate, driver, seats left, countdown and fare. **[V]**
- Price is **per seat, per corridor** (UGX 5,000 Entebbe–Kampala up to UGX 30,000 Mbarara), not distance × rate. **[V]**
- Passenger *books a seat* on a departure and can pick a seat on a 14-seater map.
- Extras sit around that: return bundle, luggage tiers, parcels on the same vans, and private charter ("Special Hire").

So the Peebee "Taxi" card = **"Book a seat on the next taxi/van on a fixed route"**. It is a different product from Peebee's existing Boda / Car (on-demand, distance-priced) and from Rideshare (driver-posted carpool trips). **[?] Please confirm that is what you mean by "order a taxi".** If you instead want on-demand taxis, most of this document changes.

---

## 2. Where it goes in Peebee

**[V] Today** the Ride sheet has a horizontally scrolling row of mode cards (Boda, Car, Rideshare, Selfdrive, Move, Luxury, Parcel). Directly **below** it is a full-width Ambulance strip (icon, "Request a crew", and a hold-to-call button) in `RideHome.tsx` ~L663. The same list is duplicated for the bottom-nav shortcuts in `BottomNav.tsx` (`rideItems`) and the landing list in `ServiceLanding.tsx`.

**Proposed layout** (my reading of your description) **[?]**:

```
[ Boda ][ Car ][ Rideshare ][ Selfdrive ][ Move ][ Luxury ][ Parcel ]   <- unchanged
[ 🚑 Ambulance  (compact, hold-to-call) ] [ 🚐 Taxi  (new card) ]       <- one row, two cards
```

- Ambulance shrinks to the left half and keeps its hold-to-call button; Taxi takes the right half.
- Tapping **Taxi** opens the Fly Express home screen inside Peebee (no splash, onboarding, sign-in or OTP).
- Add `taxi` to `rideItems` (bottom-nav) and `specialRideItems`/home-menu so it is also an admin switch (see §6). The admin home-menu description string for Ride must be updated too.
- Route: `apps/customer/app/ride/taxi/…` as normal Next.js routes, using Peebee's own header and bottom nav. **Fly Express's own sidebar, top bar, mobile nav, side drawer and "Prototype Demo" panel are not brought over.**

**Alternative:** put Taxi on the main mode row instead and leave Ambulance alone. Safer for the emergency control (a safety feature should not shrink), but not what you described, so I will follow your layout unless you say otherwise.

---

## 3. Feature inventory with my recommendation

**Include** = build in Peebee. **Adapt** = keep the idea, wire it to Peebee's existing system. **Reuse Peebee** = Peebee already has it, do not rebuild. **Skip** = leave out. **Later** = phase 2+.

### A. Core — the booking path you called most important

| # | Fly Express feature | What it does | Recommendation |
|---|---|---|---|
| 1 | **Home dashboard** (greeting, search bar, popular services, departures carousel) | Entry screen, live departure cards with countdown, seats left, plate, driver photo, price | **Include** (trim: drop wallet/parcel/upcoming cards that duplicate Peebee home; keep greeting, route search, departures, upcoming trip card) |
| 2 | **Route/stage search** (origin, destination, swap, date picker, adults/children/infants) | Finds departures for a corridor and date | **Include**, with Peebee's `PlaceSearch`/saved places for the "nearest stage" default instead of the demo's city detection |
| 3 | **Departures list + filters** (time, vehicle class, price, "Almost full") | Compare departures | **Include** |
| 4 | **Trip review screen** (route map, driver card, call/message, route details, "vehicles waiting at stage") | Final review before paying | **Include** |
| 5 | **Progressive booking accordions** (Passengers, Assistance & language, Luggage, Seat preference) | Keeps the default path short; extras opened only on demand | **Include** — this is the best design idea in the app |
| 6 | **Sticky CTA with fare and one-tap "+ Return"** | Fare always visible, return upsell in one tap | **Include** |
| 7 | **Return trip** (open return vs date-specific; discounted bundle) | UGX 9,000 vs 2 × 5,000 | **Include**, discount % becomes an admin setting |
| 8 | **Checkout** (itemised breakdown: fare, seat fee, luggage, return discount, promo, service fee) | Total before payment | **Adapt** → feed Peebee's existing order/payment flow (`orders/[id]/pay`), keep the itemised breakdown UI |
| 9 | **Booking confirmation + digital ticket with QR** | Pass with route, time, plate, seat, driver; download/share | **Include** (Peebee already has `CodeQr`) |
| 10 | **My Travels / My Tickets** (Upcoming, Completed, Cancelled) | History | **Adapt** → show taxi bookings in Peebee's existing `/orders` history plus a Taxi filter, not a second history screen |
| 11 | **Cancel & refund with retention fee** | Refund minus a % | **Adapt** → Peebee refund + admin-set retention % and time window |

### B. Seat, capacity and vehicle

| # | Feature | Recommendation |
|---|---|---|
| 12 | **14-seat interactive seat map** over the van photo (14 hotspots, disabled driver seat, +UGX 500/seat) | **Include** — it is the signature feature. Needs the supplied `14-seater` and `highroof` images. Other vehicle layouts (18, 30) are **Later** because only the 14-seat map exists |
| 13 | **"Best available" vs choose seat** | **Include** |
| 14 | **Capacity / passenger mix** (adults, children, infants; child seats) | **Include** |
| 15 | **Assistance** (wheelchair, elderly support, child seat, spoken language) | **Include** |
| 16 | **Luggage tiers** (personal free, standard 2,000, large 4,000, excess 6,000 with stage approval, fragile 7,000, commercial "assessed at stage") | **Include**, all prices admin-controlled; "commercial" needs a rule (see §7) |

### C. Map, tracking and safety

| # | Feature | Recommendation |
|---|---|---|
| 17 | **OpenStreetMap corridor preview** (condenses to a sticky mini-map on scroll) | **Adapt** → Peebee's map components (`LiveTrackingMap`, OSRM routing). Keep the sticky-condense behaviour |
| 18 | **Live trip tracking** (moving marker, speed, ETA, distance left, next stop) | **Reuse Peebee** (`LiveTrackingMap`, order location pings). The Fly Express version is simulated |
| 19 | **Tracking hub** (several active items with mini-maps) | **Adapt** into Peebee's existing track screen |
| 20 | **Fleet Radar** (all vans on a corridor) | **Later** — needs real vehicle GPS |
| 21 | **Driver profile modal, call, chat** | **Reuse Peebee** (rider profile modal, order chat, `calls`) |
| 22 | **SOS / emergency** | **Reuse Peebee** (`emergencyNumber`, hold-to-call). Do not build a second one |

### D. Money

| # | Feature | Recommendation |
|---|---|---|
| 23 | **Wallet** (balance, top-up, transfers, PIN, ledger) | **Skip — you said no.** Peebee wallet is used at checkout |
| 24 | **MTN / Airtel mobile money** | **Reuse Peebee** (payment gateway, MoMo escrow) |
| 25 | **Cash at stage with 15-minute hold** | **[?]** Conflicts with Peebee's escrow model. Include only if you want cash seats; hold time would be admin-set |
| 26 | **Corporate account** | **Later** |
| 27 | **Promo vouchers** (FLY2000) | **Reuse Peebee** voucher system if it fits; otherwise Later |

### E. Extra services on the same vans

| # | Feature | Recommendation |
|---|---|---|
| 28 | **Special Hire** (4-step private charter: vehicle, itinerary/days, driver/fuel, payment; fleet 4 → 30 seats; 18% VAT; QR receipt) | **Later (Phase 2).** Overlaps Peebee **Luxury** and **Selfdrive**. Best shipped as an extra tab inside Taxi once core booking works |
| 29 | **Express Parcel stage-to-stage** (8 steps, tiers 7,500–12,000, receipt barcode, tracking timeline) | **Adapt, do not duplicate.** Peebee already has Parcel and a **boda → matatu → boda relay** `[V]`. Fly Express parcels are exactly the matatu leg. Recommend wiring "send on the next taxi" into the relay, **not** a second parcel flow |
| 30 | **Offers and sponsored ads** | **Later.** Needs an ad inventory and admin tooling |

### F. Account, support, polish

| # | Feature | Recommendation |
|---|---|---|
| 31 | **Splash, onboarding, sign-in, OTP, guest mode** | **Skip** (already inside Peebee) |
| 32 | **Profile, saved passengers, saved pickup stages** | **Adapt** → Peebee profile/saved places, keep "saved passengers" (Peebee has `PassengerCard`) |
| 33 | **Notifications centre + preferences** | **Reuse Peebee** (push + notifications) |
| 34 | **Help, FAQs, Lost Property** | **Adapt.** Add Taxi FAQs to Peebee support. Lost Property has no Peebee equivalent `[V]`, worth keeping as a small form (**Later**) |
| 35 | **Languages** (English, Luganda, Swahili, Runyankole) and **accessibility** (high contrast, font scale, reduced motion) | **Reuse Peebee** language/appearance settings. Check Taxi strings are translated to the same set |
| 36 | **About Fly Express, privacy, terms** | **Skip** (Peebee's own pages) |
| 37 | **Rating after trip** | **Reuse Peebee** order ratings |
| 38 | **"Prototype Demo" panel, connection toggle** | **Skip** (demo tooling) |

---

## 4. What cannot be copied as it is

1. **It is vanilla JS with HTML strings and inline styles (about 486 KB of `script.js`).** Peebee is Next.js + React + Tailwind. This is a **re-build from the design**, screen by screen, not an embed. Using an iframe or loading `index.html` would break Peebee's header, auth, wallet, theming and the "fields are one solid colour" rule. I recommend against it.
2. **Colours.** Fly Express uses navy/red/blue brand colours. Peebee rules allow only existing tokens (cream, ink, gold, `surface-*`), so every screen is restyled. The layouts and flows carry over, the palette does not.
3. **Everything is fake data.** The departures are generated from the clock with invented drivers, plates and phone numbers; OTP `123456`, wallet PIN `2580` and vouchers are hard-coded. None of it ships. Real data needs tables (see §5).
4. **Hard-coded business rules** (18% VAT, UGX 500 seat fee, luggage prices, return price, retention %, 15-minute cash hold, fuel 30%, driver allowance 50,000) must become **admin settings**, as Peebee's product rules require.
5. **The operator side does not exist.** Fly Express is passenger-only. Somebody has to **publish timetables, vehicles, drivers and seat counts.** That is a Partner-app or Admin job and is the largest piece of hidden work.
6. **Brand and assets.** The logo is the *Fly Express Travellers Association*. Decide whether Taxi is shown as "Taxi by Fly Express" or plain Peebee Taxi. Photos of real drivers and vans (`driver_*.jpg`, `christo-avatar.jpg`) must be replaced with licensed or real operator content.
7. **Leaflet + CDN scripts** (unpkg, jsdelivr) → use Peebee's bundled map and QR code.

---

## 5. How it would be built in Peebee (summary)

- **API (`apps/api/src/taxi/*`)**: corridors and stages, vehicles, scheduled departures, seat inventory, bookings.
- **Bookings reuse the order engine.** Peebee already decided that car bookings carry a linked `orders` row so payments, chat, calls, tracking, ratings and fees work unchanged `[V, PEEBEE_CAR_DESIGN D1]`. Taxi seats follow the same pattern.
- **Seat inventory must be transactional** (two people cannot take seat 4A). D1 has no row locks, so use a unique `(departure_id, seat)` constraint and handle conflicts.
- **Migrations are applied by hand** `[V, CLAUDE.md]`. Everything new must work before the migration lands (`hasColumn()` guards, feature flag default **off**). The PR will list the migration file to run.
- **Customer app**: new routes under `app/ride/taxi/`, components under `components/taxi/`, new card in `RideHome.tsx`, `BottomNav.tsx`, `ServiceLanding.tsx`.
- **Admin app**: Taxi settings page (below) and a corridor/fare/timetable manager.

## 6. Settings that must be admin-controlled

Taxi on/off · corridors, stages and fare per seat · return discount · seat-reservation fee · luggage tiers and prices · max passengers per booking · booking cut-off before departure · free-cancel window and retention % · cash-hold minutes (if cash is allowed) · service fee · VAT (for Special Hire) · "Almost full" threshold · departure interval. All recorded in the activity log, with safe defaults (Taxi **off**).

## 7. Open questions for you

1. Taxi = **scheduled shared van on fixed routes** (what Fly Express is), correct?
2. Layout: **Ambulance left (compact) + Taxi right** in one row. Confirm, or put Taxi on the main row.
3. **Who publishes departures?** Fly Express as one operator managed by admin, or any partner/owner through the Partner app?
4. **Real corridors at launch:** only Entebbe ↔ Kampala, or all six?
5. **Cash at stage:** yes or no?
6. **Seat map:** 14-seater only at launch (other vans "best available")?
7. **Branding:** "Taxi", or "Taxi · Fly Express"?
8. **Commercial luggage** ("price assessed at stage"): ask for a quote, or block until staff approves?
9. **Parcels on taxis:** hook into the existing relay (recommended) or leave out of v1?

## 8. Suggested phases

| Phase | Scope |
|---|---|
| **P0 — foundation** | Taxi card + route shell behind an off-by-default flag; corridors/stages/fares and timetable in Admin; home, search, departures list, trip review, per-seat price, pay with Peebee wallet/MoMo, ticket with QR, bookings in history, cancellation |
| **P1 — the "wow"** | Progressive accordions, return bundle, luggage, assistance, 14-seat map, sticky mini-map, live tracking and driver call/chat from Peebee |
| **P2 — extras** | Special Hire, parcels on taxis via relay, offers, lost property, fleet radar, other vehicle layouts, corporate accounts |

## 9. Source of truth for each feature (for the build)

- Pricing model: PDF §3 and `calculateSpecialHirePrice()`, `parcelPrice()`, `appData.luggage`, `tripReviewFare()` in `script.js`.
- Booking state shape: `const state` (~L334) → becomes the booking draft type.
- Seat map hotspots: `renderSeatMode()` (~L5576) + `assets/fly-express-14-seater.png` (941 × 1761, 14 hotspots).
- Review screen: `renderTripDetails()` (~L2290).
- Ticket: `renderDigitalTicketCard()` (~L2783).
