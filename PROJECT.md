# Peebee — the project from A to Z

> Peebee is a "super app" for Uganda. One account and one wallet cover rides, shopping, food, parcel delivery, pharmacy, learning, home services, jobs, fuel and merchant payments. A set of installable web apps, one for each kind of user, all sit on top of a single API.

This document explains what the project is, what it does, and how it works. For commands, secrets and deploy details, see the files linked at the end.

---

## 1. What Peebee is

Peebee started as a **boda shopping concierge**: a customer posts a shopping list, and a verified rider (a boda boda motorcycle taxi driver) buys the items and delivers them. It has since grown into a platform of connected services:

| For the customer | What it is |
|---|---|
| **Ride** | Boda and car rides: on-demand, carpool, and self-drive hire |
| **Buy** | Shopping lists, groceries, stores and product listings, a short-video "Spotlight" feed, delivery |
| **Eat** | Restaurants, kitchens, street food, bakeries and juices, with a menu and ordering |
| **Learn** | Schools, classes, masterclasses and courses from kindergarten to university to everyday skills |
| **Hive** | Peebee-delivered home services (Clean, Laundry, Fix), plus **Workers** (odd jobs) and **Hire** (find a person for a project) |
| **Pharmacy** | Prescription review and medicine dispensing through licensed pharmacies |
| **Parcels and relay** | Send things by rider, or by a relay that goes boda → matatu → boda for long distances |
| **Wallet** | Mobile-money top-ups, pay-from-wallet, refunds, transfers |

The customer's home screen has **five main buttons: Ride, Buy, Eat, Learn, Hive**. Their names, order and the Hive shortcuts are an admin setting, so they can change without a release.

Other groups of people use their own apps: riders, car owners and drivers, restaurants, merchants, service providers, teachers, pump attendants, pharmacists, the sales team and Peebee staff.

---

## 2. The apps

The repository is a monorepo. Each app is a separate website, an installable PWA, with its own login, design and domain. All are built with **Next.js (App Router)** and hosted on **Cloudflare Workers**.

| App | Folder | Address | Who uses it and what for |
|---|---|---|---|
| Customer | `apps/customer` | app.peebee.online (customer.peebee.online redirects here) | The main app: ride, buy, eat, learn, hive, wallet, orders, tracking, chat |
| Rider | `apps/rider` | rider.peebee.online | Riders: take jobs, shop and deliver, wallet, fuel vouchers, savings circles |
| Restaurant | `apps/restaurant` | restaurant.peebee.online | Restaurants and kitchens: menu, orders, payments, wallet |
| Merchant | `apps/merchant` | merchant.peebee.online | Formal merchants: onboarding, outlets, staff, payments, settlements |
| Partner (car) | `apps/partner` | car.peebee.online, partner.peebee.online | Car owners and drivers: vehicles, trips, rentals, find a car |
| Work | `apps/work` | work.peebee.online | Cleaning, repair and laundry providers: jobs, team, earnings |
| Learn | `apps/learn` | learn.peebee.online | Schools and teachers: classes, courses, live lessons, grading, fees |
| TV | `apps/tv` | tv.peebee.online | Learning on the big screen: browse courses, live classes |
| Gas | `apps/gas` | gas.peebee.online | Petrol station merchants and pump attendants: redeem rider fuel vouchers |
| Pharmacy | `apps/pharmacy` | pharmacy.peebee.online | Licensed pharmacies: prescriptions, inventory, licence and compliance |
| Sales | `apps/sales` | sales.peebee.online | Peebee's sales team: sign-up, approval, growth |
| Admin | `apps/admin` | admin.peebee.online | Peebee staff: people, orders, settings, onboarding, activity log |
| Web | `apps/web` | peebee.online | The public website, terms and privacy |
| API | `apps/api` | api.peebee.online | The backend all apps talk to |
| Preview hub | `apps/preview-hub` | — | Routes branch previews |

Shared code lives in `packages/shared` (`@peebee/shared`).

---

## 3. How the system is put together

```
 Browser / phone / TV                         Cloudflare
 ┌─────────────────────┐   HTTPS   ┌──────────────────────────────────────┐
 │ Customer, Rider,    │ ────────▶ │ API Worker  (Hono, TypeScript)       │
 │ Restaurant, Admin…  │           │   ├─ D1 database  (SQLite)           │
 │ (Next.js PWAs)      │ ◀──────── │   ├─ R2 bucket    (private files)    │
 │  + service worker   │   JSON    │   ├─ Workers AI   (voice/speech)     │
 └─────────────────────┘           │   ├─ Cron         (sweeps, renewals) │
          ▲                        │   └─ Web Push, calls (TURN), email   │
          │ each app is its own    └──────────────────────────────────────┘
          │ Worker on a custom domain         │
          └──────────────────────────          ▼ Mobile money (MTN, Airtel, Yo, Flutterwave)
```

- **Front ends**: Next.js apps compiled for Cloudflare Workers with OpenNext. Each is its own Worker with its own domain and its own `wrangler.jsonc`.
- **API**: a Hono application (`apps/api/src/app.ts`) running as one Cloudflare Worker, mounted under `/v1/...`. The code is split by area: `auth`, `orders`, `riders`, `restaurants`, `merchants`, `wallet`, `ledger`, `payments`, `car`, `work`, `talent` (Hire), `education`, `pharmacy`, `gas`, `relay`, `stages`, `marketplace`, `guest`, `push`, `calls`, `speech`, `voice`, `admin`, `settings` and more.
- **Database**: Cloudflare **D1** (SQLite), bound directly to the API Worker. Local development uses a Turso/libSQL database, because D1 bindings only exist inside a Worker.
- **Files**: Cloudflare **R2** (`RIDER_DOCS` binding) holds private documents such as ID scans, chat media, restaurant and merchant KYC files, and fetching them is permission-checked.
- **Scheduled work**: Worker cron triggers (every 2 minutes and daily at 03:00 UTC) expire stale orders, renew subscriptions and run scheduled car and Hire jobs.
- **Notifications**: Web Push with VAPID keys, with an in-app notification sound. Voice and video calls use WebRTC with a TURN server.
- **Maps**: map tiles, OpenStreetMap geocoding and an OSRM router for road routes; the customer and rider apps draw live tracking maps.

---

## 4. How a typical order works

Every order moves through the same journey. The stages are defined once in `packages/shared/src/order-stage.ts`:

`Create → Match → Fund → Shop → Substitute → Approve → Deliver → Arrived → (PickedUp for rides) → Handover → Settle`

1. **Create**: the customer posts a shopping list, a parcel, or a ride request. Prices come from an admin-controlled fare engine, and customers can also use guest checkout from a shared product link.
2. **Match**: a rider is found. The matching mode is an admin setting: *first to claim*, *nearest within a time window*, or *customer selects* from applicants. Riders can propose a different fee and the customer accepts or rejects it.
3. **Fund**: the customer pays into **escrow**, so the money is held while the work happens.
4. **Shop / Substitute / Approve**: the rider buys the goods, proposes substitutions when something is missing, and the customer approves.
5. **Deliver → Arrived → Handover**: the rider travels with live location tracking. At handover the customer gives a **4-digit PIN** to prove the delivery. Ride orders include a `PickedUp` stage.
6. **Settle**: the escrow is released to the rider, to the merchant or restaurant, and to Peebee's fee account, and ratings are collected.

Around that core are waiting and cancellation fees, order chat and calls, push notifications, expiry sweeps and order ratings.

### Long-distance relay
For parcels too far for one rider, a **relay** splits the trip into three legs: first rider → matatu (minibus) operator → last rider. The last rider hands over with the customer's PIN.

---

## 5. Money

Peebee keeps two cooperating money systems, both with a clear separation between **sandbox** and **live** money:

- **Wallets**: customer and rider balances, top-ups, withdrawals and transfers (`apps/api/src/wallet`).
- **Double-entry ledger**: every movement is recorded as balanced entries with idempotent posting (`apps/api/src/ledger`). It is the source of truth for escrow, fees, merchant settlements and car-booking deposits.
- **Payment providers** sit behind one gateway adapter (`payments/gateway.ts`), with adapters for **MTN MoMo, Airtel Money, Yo and Flutterwave**, each with a mock. Business code never talks to a provider directly. Which providers are active, and demo mode, are admin settings. The checked-in worker config currently uses a mock provider, so real payment-provider setup is an account-level step.
- **Fees, profit shares and penalties** (rider payout, platform fees, time fees) are settings, not constants.
- **Merchant payments**: merchants have outlets with codes, staff and settlement destinations (encrypted with `CREDENTIALS_ENCRYPTION_KEY`) and a KYC case. Riders can also pay merchants by outlet code.
- **Fuel vouchers**: riders can hold fuel vouchers that gas-station attendants redeem through the Gas app.
- **Savings circles**: stage-based VSLA-style groups for riders, cash-first, where every money step is an intent confirmed by an officer.

---

## 6. The services in more detail

- **Car**: on-demand rides, carpooling, scheduled rides, car deals and self-drive hire. Car owners and drivers stay ordinary customer accounts, with extra rows that mark them as partners. Ride requests reuse the same order, fare-negotiation, tracking and ledger machinery.
- **Food**: restaurants, kitchens, street food, bakeries and juices have a menu builder, covers and logos, ordering, feedback, and chat with the customer. Demo food data makes new apps look populated.
- **Marketplace**: stores, products, groceries, a "Spotlight" short-video feed and shared product links.
- **Work (Clean, Fix, Laundry)**: a jobs engine where customers book a service and independent providers (individuals or companies with staff) do it. Peebee holds the money until the customer confirms. Pricing is *fixed* (catalogue) or *quote* (inspect, then quote). Matching is broadcast, customer picks, or admin assigns.
- **Hire (talent)**: a freelancer and local-workforce module with profiles, job posts, bids, contracts, escrow or direct payment, a banned-terms screen, subscriptions and plans. It is switched off until `talent_enabled` is on. The code and tables use the name `talent_*`.
- **Learn**: five learning **streams** (Sprouts for ages 3–6, Foundations/"Basics" for primary school, Academy for secondary, Compass for university, Skills for everyday learners). The shape is school → class → course → module → lesson. It includes a quiz and exam engine, assignments and a gradebook, certificates and badges, drip release, live classrooms, cohorts, reviews and Q&A, coupons, bundles and school passes, tuition fees and uploads. **Peebee TV** shows the same content on a TV, linked to a customer account by a code.
- **Pharmacy**: licensed pharmacies review prescriptions, manage inventory and licence compliance (the NDA, Uganda's drug regulator), and dispense.
- **Gas**: station merchants and attendants run shifts, set prices and redeem fuel vouchers.
- **Stage savings circles and rider "Pro"**: community features for riders.
- **Voice and AI**: speech-to-text and text-to-speech endpoints, voice notes, and shopping-list narration, using Cloudflare Workers AI.

---

## 7. People, accounts and permissions

- **Sign-in**: phone or email with password, one-time verification codes, Google sign-in, and account activation links. Sessions use signed tokens (JWT). If a session is rejected, the app clears its local copy and returns to login.
- **Roles**: customer, rider and admin at the user level. Other roles (car owner, restaurant owner, merchant staff, teacher, provider) are separate records attached to an ordinary account, so one person can do several things on one login.
- **Staff permissions**: admin roles carry named permissions (`work.view`, `work.manage`, and so on). Sensitive actions are logged in an **activity log**, and many can be reverted.
- **Practice (demo) mode**: every app can run a guided, sandboxed walk-through with fake data, with no real money moved (`packages/shared/src/practice*.ts`).

---

## 8. Admin controls the behaviour

A core product rule: **anything that defines how the app works is a setting, not a constant in code**. This covers switches, work modes, limits, thresholds, percentages, time windows, profit shares and penalties. Each setting is:

1. stored in the `settings` table,
2. validated in the API's settings routes,
3. editable on an Admin page,
4. recorded in the activity log, and
5. given a safe default.

Examples: which services are on, matching modes, fare and fee rules, the home-screen menu, payment providers, Hire monetization, and the time-fee policy. Code keeps only structural safety rails, such as "a fee is always under 100% of the fare".

---

## 9. How the apps load: offline-first, with wireframes

Every front end follows the same pattern:

- **Cached first.** Each app's service worker (`public/sw.js`) shows pages, code and images from the browser cache and checks the server in the background. Build files are content-hashed and kept in a stable cache. Page HTML and Next.js navigation data are shown first and refreshed behind the scenes. API reads are shown from the cache and refreshed, and **only changed data comes from the server**.
- **Fresh when it changes.** When the server's copy of data differs from what was shown, the worker tells the open screen, and a shared wrapper (`DataRefresh`) reloads the screen. It waits if the person is typing or a dialog is open.
- **Safe on logout.** Logging out clears the cached pages and data, so a shared phone never shows the previous person's data. Posts and other writes always go straight to the network.
- **Wireframe loading.** While a screen loads, a grey wireframe of that very screen is shown: its real layout, cards and sizes with every piece of content replaced by a grey block. The wireframe is learned from the screen itself after it first loads, and only its structure is kept (text is masked, links, images and values are dropped), so it follows design changes automatically. A screen never opened on that device gets a generic wireframe.
- **Per-app sign-in artwork.** The welcome and sign-in screens use an illustration for each app (`public/brand/auth-art.svg`, or its own image for the restaurant app).

---

## 10. Repository layout

```
apps/
  api/           Hono API on Cloudflare Workers (src/<area>/, db/migrations/*.sql)
  customer/ rider/ restaurant/ merchant/ partner/ work/ learn/ tv/
  gas/ pharmacy/ sales/ admin/ web/ preview-hub/
packages/shared/ Shared types and logic: order stages, fares, API client, practice mode,
                 education types, auth screens, DataRefresh (wireframes + fresh data)
workers/api/     Legacy scaffold, left alone
infra/           Deploy notes, env names, runbook, app/domain table
docs/            Specs: car, work engine, Hire, merchant payments, QA notes
scripts/         preflight-deploy.mjs (deploy guard), demo-video generator
tools/stubs/     A no-op stub for the image library on Workers
assets/          Brand and auth artwork sources
.github/         CI and deploy workflows
```

---

## 11. Building, testing and deploying

- **Tooling**: Node 22 or newer and pnpm 9 (`pnpm install` at the root). Each app has `dev:*` and `build:*` scripts in the root `package.json`.
- **Local**: the front ends read `NEXT_PUBLIC_API_URL` and the API runs locally against a Turso database. See [`infra/RUNBOOK.md`](infra/RUNBOOK.md).
- **Tests**: about 80 test files, mostly in the API (integration tests for orders, relay, car, Work, Hire, Learn, merchants, guests and more) plus unit tests for fares, carts and pricing.
- **CI** (`.github/workflows/ci.yml`): type-check, run tests, and build every app on each pull request.
- **Deploy** (`.github/workflows/deploy.yml`): pushing to `main` deploys the apps whose files changed. A change to `packages/shared`, the lockfile or the workflow deploys every app. It can also be started by hand with a list of apps. Each app's `deploy` script first runs `scripts/preflight-deploy.mjs`, which refuses to deploy unless the branch is `main`, the working tree is clean, and local `main` equals `origin/main`.
- **Database migrations are applied by hand.** The SQL files in `apps/api/src/db/migrations/` are **not** run by the deploy, so code can reach production before its migration. New code that reads a new column must keep working until the migration lands (check with `hasColumn()` / `hasTable()`, or keep the feature behind a flag that defaults off). Each pull request with a migration must name the file to apply.

### Working rules (people and AI assistants)
1. Fetch `origin`, then create a branch (`claude/<task>` or `codex/<task>`) from current `origin/main`. Never develop on `main`.
2. Use a separate worktree if another developer or assistant is active.
3. Never include unrelated uncommitted changes in a commit.
4. Commit and push finished work, merge through a pull request, and deploy only from a clean `main`.
5. UI rules: a field is one solid colour edge to edge, and only the existing colour tokens (cream, ink, gold, `surface-*`) are used.

See [`COLLABORATION.md`](COLLABORATION.md), [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

---

## 12. Where to read more

| Topic | File |
|---|---|
| Local setup and commands | [`infra/RUNBOOK.md`](infra/RUNBOOK.md) |
| Apps, workers and domains | [`infra/PEEBEE-APPS.md`](infra/PEEBEE-APPS.md) |
| Cloudflare deploy and gotchas | [`infra/CLOUDFLARE.md`](infra/CLOUDFLARE.md) |
| Environment variable names | [`infra/ENV.md`](infra/ENV.md) |
| Front-end notes | [`FRONTEND.md`](FRONTEND.md) |
| Brand | [`BRAND.md`](BRAND.md) |
| Car design | [`docs/PEEBEE_CAR_DESIGN.md`](docs/PEEBEE_CAR_DESIGN.md) |
| Work engine | [`docs/work-engine.md`](docs/work-engine.md) |
| Hire spec | [`docs/JOBS_MODULE_SPEC.md`](docs/JOBS_MODULE_SPEC.md) |
| Merchant payments | [`docs/MERCHANT_PAYMENTS_PLAN.md`](docs/MERCHANT_PAYMENTS_PLAN.md) |
| API key rotation | [`docs/api-key-rotation.md`](docs/api-key-rotation.md) |

Secrets are never committed. They are set with `wrangler secret put`, for example `JWT_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`.
