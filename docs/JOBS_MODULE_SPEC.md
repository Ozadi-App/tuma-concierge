# Peebee Jobs — product & technical spec

Status: **built** (API, customer app, admin app), switched off until `talent_enabled` is turned on. The module is named `talent_*` in code and tables because `work_*` already belongs to Clean/Fix/Laundry. Migration to apply by hand: `apps/api/src/db/migrations/0110_talent_jobs.sql`.

Decisions since the first draft: employers are any customer (a Hire mode, plus a worker-search directory); escrow and direct payment are both built and admin picks which are live; illegal or unconstitutional work is screened against an admin-editable term list; monetization is fully data-driven (fee rules, plans, Pro features, free trial, free onboarding and a master free-access switch).
Inspiration: WeWork-style flexible local workforce, Upwork/Freelancer mechanics (bids, escrow, reviews), a little LinkedIn (profile-as-CV, hiring).

## 1. Decisions so far

| Question | Decision |
|---|---|
| "WeWork" means | A flexible local workforce: people available for work near you, on demand. |
| Who uses it | Informal sector (casuals, artisans, boda riders) and white-collar freelancers/professionals, in one module. |
| Scope | Build every job type. **Admin decides which are live** (per-type switches). |
| Who can work | Anyone with a Peebee account, **including existing riders and partners**, as a side income. |
| First release | Customer app: a **Find work** view (worker) and a **Hire** view (employer). No new standalone app. |

## 2. Today's state

- `/service` ("Jobs" landing) lists Laundry, Fix, Jobs, Learn; the **Jobs tile links back to `/service`** and `/services/jobs` redirects to it. Nothing exists behind it.
- `apps/partner/app/jobs` and the rider "jobs" screens mean *delivery jobs*. The new module must not reuse that name in the UI or API (use **Work** / `work_*`) to avoid confusion.
- Reusable building blocks already in the repo: `ledger/service.ts` (double-entry), `wallet/`, `payments/` (MTN/Airtel/Flutterwave MoMo), `verify/` (OTP, email), `car/` apply-with-bid pattern, `push/`, `calls/`, `speech/` + `voice/`, `lib/service-gate.ts` and `service_*_enabled` settings, `hasTable()/hasColumn()` for hand-applied migrations.

## 3. Roles

- **Worker** — profile, availability, applies/bids, gets paid. Any user can become one. Riders/partners keep their role; worker status is a separate record (same approach as `car_partners`, which leaves `users.role` untouched).
- **Employer** — individual or business posting work. Same account; "Hire" is a mode in the customer app. Optional business profile (name, logo, verified).
- **Admin** — controls switches, fees, limits, verification, disputes, moderation.

## 4. Job types (each independently switchable by admin)

| Type | Typical | Mechanics |
|---|---|---|
| **Quick gig** | Errand, queue, cleaning, event help, moving help | Fixed price, hours/same day. Nearest eligible workers notified; first to accept, or employer picks from applicants (admin chooses per type). |
| **Project** | Design, tailoring, photography, construction, writing, IT | Budget range, bids with message, optional milestones, escrow per milestone. |
| **Hiring** | Part-time/permanent roles (shop assistant, driver, cook, accountant) | Employer posts a role, candidates apply with profile, employer shortlists and contacts. Paid listing; no escrow (payroll is outside Peebee). |
| **Recurring** *(later within the same build)* | Weekly cleaner, regular driver | Repeats a gig on a schedule. |

## 5. Core flows

**Gig/project**
1. Employer posts: title, category, description (text or voice note → transcript), photos, location/area, when, budget, type.
2. Pre-moderation or auto-publish, per admin setting.
3. Workers see a feed filtered by distance, category, skills, budget. Apply (one tap for gigs; message + price for projects).
4. Employer accepts one (or several for multi-worker gigs). Budget is **held in escrow** from the employer's wallet / MoMo.
5. Work happens; chat/call in-app (reuse `calls/`; keep contact details private until acceptance).
6. Worker marks done → employer confirms (or auto-confirms after an admin-set window) → escrow released minus platform fee.
7. Both sides rate each other. Disputes freeze escrow and go to admin.

**Hiring**
Employer pays the posting fee (if admin set one) → role is published → candidates apply with their work profile → employer shortlists/rejects/messages → mark filled.

## 6. Worker profile ("CV")

Headline, bio (text/voice), skills, categories, area and radius, languages, availability (now / schedule), rates (optional), work history **auto-built from completed Peebee jobs**, uploaded portfolio and CV, education/experience (white-collar), ratings, completion rate.
Trust: phone verified (`verify/`), ID verified (admin review, like `car_partners`), badges ("Peebee verified", "Top rated"), endorsements (later).

## 7. Money

- All amounts in integer UGX; every money movement is a balanced ledger transaction (`ledger/service.ts`). Add ledger owner type(s) for escrow (e.g. `job`), reusing `provider`/`customer` for sides.
- Escrow: hold → release (to worker wallet) → refund (to employer) → partial (dispute split). Platform fee taken on release.
- Fees (admin settings): gig commission %, project commission %, hiring listing fee, optional worker-side fee, boost/featured price, minimum job value, maximum job value.
- Worker payout: to wallet, withdraw via MoMo with existing wallet/withdraw rails.
- Riders: no change to delivery earnings; Work earnings are a separate ledger stream shown in the same wallet.

## 8. Data model (new tables only — no existing table altered)

Migration: `apps/api/src/db/migrations/0096_jobs_work.sql` *(next free number at time of writing; check before applying)*.

- `work_categories` (id, parent_id, name, kind, active, sort)
- `work_profiles` (user_id PK, headline, bio, voice_key, skills JSON, area, lat, lng, radius_km, languages JSON, rate_min, rate_max, availability, status [none/pending/approved/suspended], id_document_key, rating_avg, rating_count, completed_count, created_at, updated_at)
- `work_employers` (user_id PK, business_name, logo_key, verified, status)
- `work_jobs` (id, employer_id, type [gig/project/hiring/recurring], category_id, title, description, voice_key, area, lat, lng, remote INTEGER, starts_at, deadline, budget_min, budget_max, price, workers_needed, status [draft/pending_review/open/in_progress/completed/cancelled/disputed/filled/closed], fee_percent_snapshot, created_at, updated_at, expires_at)
- `work_job_photos` (job_id, key, sort)
- `work_applications` (id, job_id, worker_id, message, bid_amount, status [applied/shortlisted/accepted/rejected/withdrawn], created_at) — unique (job_id, worker_id)
- `work_milestones` (id, job_id, title, amount, status [pending/funded/submitted/released/refunded], ...)
- `work_escrow` (id, job_id, milestone_id, amount, status, ledger_tx_id, created_at, released_at)
- `work_reviews` (id, job_id, from_user, to_user, rating, comment, created_at) — unique (job_id, from_user)
- `work_disputes` (id, job_id, opened_by, reason, status, resolution, resolved_by, ...)
- `work_messages` (or reuse chat infrastructure from `restaurant-chat` if suitable)
- `work_reports` (reporter, target type/id, reason) for moderation

**Migration safety (per CLAUDE.md):** all code is gated behind `work_enabled` (default off) and `hasTable()` checks, so shipping code before the hand-applied migration cannot break existing hot paths. Add the new table names to the `hasTable` union in `lib/schema.ts`. The PR description must name the migration file.

## 9. API (`apps/api/src/work/`, mounted under `/v1`)

Customer/worker: `GET /work/feed`, `GET /work/jobs/:id`, `POST /work/jobs` (employer), `PATCH /work/jobs/:id`, `POST /work/jobs/:id/apply`, `POST /work/applications/:id/{accept,reject,withdraw}`, `POST /work/jobs/:id/{fund,start,submit,confirm,cancel,dispute}`, `GET/PUT /work/profile`, `GET /work/profiles/:id`, `POST /work/reviews`, `GET /work/me/{jobs,applications,earnings}`.
Admin (`work/admin-routes.ts`): categories CRUD, profile/ID approvals, job moderation queue, disputes, fee/limit settings, reports, activity-log entries for every change.
Every route checks `isServiceEnabled("work")` and the per-type switch via `lib/service-gate.ts`.

## 10. Admin-controlled settings (all in `settings`, validated in `settings/routes.ts`, shown on an admin page, logged, safe default)

- `service_work_enabled` (master, default **off**)
- `work_gig_enabled`, `work_project_enabled`, `work_hiring_enabled`, `work_recurring_enabled` (default off)
- `work_riders_can_work` (default on), `work_require_id_verification` (default on), `work_require_job_review` (default on)
- Fees: `work_gig_fee_percent`, `work_project_fee_percent`, `work_hiring_listing_fee`, `work_worker_fee_percent`, `work_boost_price`
- Limits/time windows: `work_min_job_amount`, `work_max_job_amount`, `work_auto_confirm_hours`, `work_dispute_window_hours`, `work_job_expiry_days`, `work_max_open_jobs_per_employer`, `work_max_applications_per_worker_per_day`, `work_search_radius_km_default`
- Penalties: `work_cancel_penalty_percent`, `work_no_show_penalty`
- Structural rail kept in code: total fee is always < 100% of the job value.

Admin pages: `settings/work` (switches + fees + limits), `work/jobs`, `work/workers`, `work/disputes`, `work/categories`.

## 11. Customer app (UI)

- Replace the looping "Jobs" tile: `/service` → **Work** hub with two clear entries: **Find work** and **Hire**. Laundry/Fix/Learn stay as tiles and also act as pre-filtered categories in Work.
- Find work: feed, filters, job detail, apply, my applications, active jobs, earnings, profile editor.
- Hire: post a job (3-step, voice optional), my jobs, applicants, accept & fund, confirm & rate.
- Follow the UI rules: single-colour fields edge to edge (`field-box` for multi-part), existing tokens only. i18n strings in `lib/i18n.tsx`. Push notifications for new matching jobs, applications, acceptance, funding, completion.

## 12. Trust, safety, abuse

ID + phone verification gate; employers can't pay outside escrow without a warning; contact details hidden until acceptance; report/block; keyword and rate-limit moderation on posts; ban categories (admin list); minors and illegal-work rules in terms; dispute evidence (photos, chat). Add Work terms to `apps/web/app/terms`.

## 13. Build plan (all built; admin enables progressively)

1. **Foundation:** settings, migration, service gate, categories, profiles + ID approval, admin skeleton.
2. **Quick gigs end-to-end:** post → apply/accept → escrow → complete → payout → reviews.
3. **Projects:** bids, milestones, partial release.
4. **Hiring:** listings, fees, applicant pipeline.
5. **Disputes, moderation, recurring jobs, boosts, endorsements.**
Each phase ships dark (switch off), is testable in admin preview, and has integration tests following `car.integration.test.ts`.

## 14. Open questions

1. Is "employer view" just a mode inside the customer app, as assumed here, or should businesses get a separate app?
2. Should escrow funding be required for every gig, or can admin allow cash-on-completion for small gigs (with a trust score instead)?
3. Do you want worker-side fees at launch, or employer-side only?
4. Any categories or kinds of work to forbid from day one?
5. Hiring: is a paid listing fee at launch, or free until traction?

## Update: recurring jobs and late-cancel fees (built)

- **Recurring jobs.** An employer repeats a gig daily, weekly, biweekly or monthly. "Rehire" books the same worker again each period (a new contract, escrow held when the period starts); "repost" puts a fresh open job up each period (listing fee applies). A run that fails (wallet too low, worker unavailable) is skipped, and the schedule pauses after an admin-set number of failures in a row. Either side can end a rehire schedule. Admin controls: on/off, which intervals are offered, max schedules per employer, max runs, failure limit, and "Recurring jobs" can be marked a Pro feature.
- **Late-cancel fees.** Cancelling is free for an admin-set window after a contract starts. After that it costs a flat UGX 5,000 by default (admin can change the amount, or switch to a percentage of the work not yet paid; never charged under All free access). A share (default 70%) goes to the person cancelled on; the rest is Peebee's. An employer's fee comes out of the escrow refund; otherwise it is taken from the canceller's wallet (or recorded as owed). The canceller must confirm the fee before it is charged.
