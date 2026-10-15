# Peebee Work engine

The jobs engine behind **Clean**, **Fix** and **Laundry**: customers book a service, independent providers
(individuals or companies) do it, and Peebee holds the money until the job is confirmed. It lives in
`apps/api/src/work/` and is mounted at `/v1/work`. Customers, providers and staff all sign in with an ordinary
Peebee account; what each can do depends on their role in the engine.

Clean is the first service type with a catalogue. Fix and Laundry plug into the same tables: add their
catalogue rows, switch the type on in Admin, and they work with no new code (see "Adding a service type").

## Who does what

| Role | How they are identified | Can |
|---|---|---|
| Customer | any signed-in, non-admin account | browse the catalogue, book, choose a provider, accept/decline a quote, cancel, confirm, report a problem, rate |
| Provider (individual) | a `work_providers` row, kind `individual` | go online, take or offer on jobs, quote, run the job, see earnings |
| Provider (company) | kind `company`; the owner is a member | the same, plus add staff and assign them jobs. Staff only see jobs assigned to them, and can start and finish them. Payouts always go to the owner |
| Staff (Peebee) | admin account with `work.view` / `work.manage` | manage the catalogue, approve providers, assign jobs, cancel, rule on reported problems |

## What admin decides (all settings, nothing hard-coded)

Admin → Settings → `work` group (`PUT /v1/admin/settings` with a `work` object; validated in `settings/routes.ts`, read back from `GET /v1/settings`).

| Setting | Default | Meaning |
|---|---|---|
| `enabled` | on | Master switch for customers and providers (staff keep access to finish open jobs) |
| `serviceTypes` | `clean` | Which kinds of work can be booked: `clean`, `fix`, `laundry` |
| `pricingModes` | `fixed, quote` | **fixed**: price per unit from the catalogue. **quote**: provider inspects (call-out fee held), then quotes |
| `matchingModes` | `broadcast, customer_picks` | **broadcast**: nearby providers are pinged, first to accept wins. **customer_picks**: providers send offers, the customer chooses. **admin_assigns**: staff assign. If more than one is on, the customer chooses; otherwise the default is used |
| `defaultMatching` | `broadcast` | Used when the customer doesn't choose (always one that is switched on) |
| `providerKinds` | `individual, company` | Who may register |
| `commissionPercent` | 15 | Peebee's share. Each service can override it |
| `requireApproval` | on | Providers must be approved by staff before they can go online or take jobs |
| `offerWindowMinutes` | 60 | How long an unclaimed job stays open before it expires and is refunded |
| `radiusKm`, `maxNotified` | 15, 20 | How far and how many providers are pinged |
| `minLeadMinutes`, `maxAdvanceDays` | 30, 30 | Scheduling bounds |
| `quoteValidHours`, `maxQuoteUgx` | 24, 5,000,000 | Quote lifetime and ceiling |
| `freeCancelMinutes`, `lateCancelFeePercent` | 10, 20 | After a provider is on the job, cancelling later than this pays them a share |
| `autoConfirmHours` | 24 | A finished job pays out by itself if the customer says nothing |
| `disputeWindowHours` | 48 | How long after completion a problem can be reported |
| `jobsPerHour` | 6 | Bookings one customer can make per hour |
| `rematchOnProviderCancel` | on | If a provider cancels after taking a job, offer it to other providers instead of refunding the customer |
| `maxRematches` | 2 | Most times one job goes back out; after that the customer is refunded |
| `photosEnabled`, `maxPhotosPerJob`, `maxPhotoKb` | on, 8, 4096 | Photos on a job, how many, and the largest one |
| `chatEnabled` | on | Customer and provider can message each other about a job |
| `trackingEnabled` | on | The customer sees the provider's location while the job is booked or in progress |
| `onsiteCheckEnabled` | **off** | On-site checks (migration 0100): keep a location trail during jobs and flag cancellations that follow a long stay at the address |
| `onsiteRadiusM`, `onsiteMinMinutes` | 150, 20 | How close counts as "on site", and how many minutes there before a cancellation is flagged |
| `onsiteAction` | `flag` | `flag`: put it in the review queue. `suspend`: also suspend the provider until staff review it |
| `onsiteFlagNoLocation` | on | Also flag a cancellation when the provider held the job that long and never shared a location |
| `onsiteRequireLocation` | on | With on-site checks on, a provider can only tap Start after a location update from the last five minutes |
| `onsiteSuspendAfterFlags`, `onsiteWindowDays` | 0 (off), 30 | Suspend automatically once a provider has this many open or upheld flags inside the window |
| `locationRetentionDays` | 30 | Location trails are deleted after this long (those behind an unreviewed flag are kept) |

The catalogue (`work_services`) is also admin-edited: price, unit, call-out fee, quantity limits, pricing mode,
commission override, active flag.

## A job's life

```
pending_payment ─(money held)→ open ─┬─ broadcast: provider accepts ─────────────┐
                                     ├─ customer_picks: offers → customer picks ─┤
                                     └─ admin assigns ───────────────────────────┤
                                                                                  ▼
  fixed price ───────────────────────────────────────────────────────────→ booked
  quote price:  assigned ─(provider quotes)→ quoted ─(customer accepts, pays difference)→ booked
                          └─ declined / lapsed: provider keeps the call-out fee, less commission
booked ─(start)→ in_progress ─(complete)→ completed ─┬─ customer confirms or auto-confirm → settled
                                                     └─ customer reports a problem → disputed → admin: release / refund / split
open | assigned | quoted | booked ─cancel→ cancelled        open past its window → expired (refunded)
```

Every transition is one conditional `UPDATE … WHERE status IN (…)`, so when several requests race (two providers
accepting, a double tap) exactly one wins.

## Money

- The customer's **wallet** is the payment. Booking holds the full price (fixed) or the call-out fee (quote) at
  once. If the wallet can't cover it, nothing is created.
- Holds, refunds and payouts are rows in `work_money`, applied by **one atomic batch that only acts while the
  row is still `pending`**. Applying twice (a retry, a crash, two sweeps) changes nothing. Row ids are fixed per
  job and kind (`payout:<job>`), so a repeated outcome is ignored.
- A status change and the money rows it causes are written in the **same batch**; they can never be separated.
- Only the request that took money may ever give it back (a repeated tap sees it already charged and leaves it).
- Commission is copied onto the job when it is booked, so later settings or catalogue changes never reprice a
  job in progress. Refund + commission + payout always add up to exactly what was held.
- The cron heartbeat (`sweepWork`) expires unclaimed jobs, lapses ignored quotes, auto-confirms finished jobs,
  clears bookings that never got paid, and applies any refund or payout that did not finish.

## API

All under `/v1/work`, all need a signed-in account. Until migration `0098` is applied everything answers
`503 work_upgrade_pending`.

Also (migration 0099): `POST|GET /jobs/:id/photos`, `POST|GET /provider/jobs/:id/photos`, `GET /photos/:photoId`,
`GET|POST /jobs/:id/messages`, `GET|POST /provider/jobs/:id/messages`, `POST /provider/jobs/:id/location`. Provider cancel
now returns `{ ok, rematched }`.

**Customer**: `GET /catalog`, `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/offers/:offerId/select`,
`POST /jobs/:id/quote/accept|decline`, `POST /jobs/:id/cancel|confirm|dispute|rate`.
`POST /jobs` takes an optional `idempotencyKey`; a repeat returns the first booking and charges nothing more.
Responses include an `actions` list (what the customer can do next) so apps don't need to know the rules.

**Provider**: `POST /provider/register`, `GET|PUT /provider/me`, `GET|POST /provider/staff`,
`DELETE /provider/staff/:userId`, `GET /provider/jobs/open`, `GET /provider/jobs`,
`POST /provider/jobs/:id/accept|offer|quote|assign-worker|start|complete|cancel`, `DELETE /provider/jobs/:id/offer`,
`GET /provider/earnings`.

**Admin**: `GET|POST /admin/services`, `PATCH /admin/services/:id`, `GET /admin/providers`,
`POST /admin/providers/:id/approve|reject|suspend|reinstate`, `GET /admin/jobs`, `GET /admin/jobs/:id`
(with events, money and offers), `POST /admin/jobs/:id/assign|broadcast|cancel|resolve`.
Changes are written to the admin activity log. Permissions: `work.view`, `work.manage` (operations manager
has both; finance, support and compliance can view).

## Re-matching, photos, chat and live location (migration 0099)

- **Re-matching.** When a provider cancels, a fixed-price job (booked) or a quote job that has no accepted price yet
  (assigned or quoted) goes back to `open` with its money still held, and nearby providers are told again. The provider
  who backed out can't take it again. The window for unclaimed jobs restarts, and `maxRematches` caps it; after that, or
  once a quote was accepted, or if the setting is off, the customer is refunded and the job closes as before.
- **Photos.** The customer attaches photos of what needs doing; the provider adds before/after photos once the job is theirs.
  Files are checked by their bytes (JPEG, PNG, WebP), kept in private storage, and only people on the job (and staff) can
  fetch them. A provider who could take an open job can see the customer's request photos.
- **Chat.** Text messages between the customer and the provider (or the staff member doing the job), from the moment a
  provider is on the job until it is paid out. Rate-limited; the other side gets a notification.
- **Live location.** The person doing the job shares their position; the customer's job view carries `providerLocation`
  only while the job is booked or in progress. Pings closer together than four seconds are dropped.

Until `0099` is applied these endpoints answer `503 work_upgrade_pending`, a provider who cancels refunds the customer as
before, and the public settings report photos, chat and tracking as unavailable. The new Fix and Laundry catalogues are in
the same migration; turn those types on in Admin (`serviceTypes`) when you want them live.

## On-site checks (migration 0100)

Meant to discourage cancelling a job so the work can be paid for in cash off the app. It is evidence for a person to
review, not proof: GPS can be wrong, switched off or faked, a provider can have a good reason to be at an address, and the
provider app only reports location while the job page is open and the phone is awake.

- While a job is booked or in progress and the switch is on, every stored location update is also kept as a trail point
  (`work_job_locations`, with the device's accuracy). Updates less accurate than the on-site distance are ignored when measuring.
- When a customer or provider cancels (including a provider cancel that re-matches the job), the trail for that provider is
  measured: time spent within the on-site distance, counting only gaps between pings of five minutes or less. At or above the
  minutes admin set, a `cancel_after_onsite` flag is raised. A provider who held the job that long and shared nothing gets
  `cancel_no_location` (switchable). Jobs without an address position are skipped.
- Flags (`work_flags`) appear under Admin → Work → Flags with the stay, the cancellation, the trail and earlier flags.
  Staff **dismiss**, **warn** (the provider is notified) or **suspend**. A suspended provider goes offline and can't take jobs
  until reinstated on the Providers page.
- `onsiteAction = suspend`, or `onsiteSuspendAfterFlags` flags inside `onsiteWindowDays`, suspends automatically. Both are
  off by default; staff review each case first.
- Location is only collected while a job is booked or in progress (never while merely online), and only by the provider app.
  A web page can't read GPS once it isn't on screen, so the provider app asks the phone to keep the screen on while sharing
  (Wake Lock) and warns the provider when updates stop for a minute. Holes in the trail while on site are shown to the reviewer.
  A native app would be needed to track with the screen off or the app closed; that is not built.
- "I've arrived" (`POST /provider/jobs/:id/arrived`) is accepted only when the provider's latest location (under five minutes
  old) is within the on-site distance of the address; the customer is told and staff see it on a flag. Starting a job needs a fresh
  location when `onsiteRequireLocation` is on.
- Admin endpoints: `GET /admin/flags`, `GET /admin/flags/:id`, `POST /admin/flags/:id/review` (`work.view` / `work.manage`).
- The provider app tells providers that their location is recorded during a job. The late-cancel fee (`lateCancelFeePercent`)
  still applies to a customer who cancels after the free window, whatever the flag says.
- Until `0100` is applied, or while the switch is off, nothing is recorded or flagged and the admin Flags page says an update is needed.

## Applying it

1. Apply `apps/api/src/db/migrations/0098_work_engine.sql` by hand (all new tables, plus a starting Clean
   catalogue of 17 editable services across houses, offices, pets, cars and household items).
2. Apply `0099_work_extras.sql` for re-matching, photos, chat, tracking and the Fix/Laundry catalogues (optional; everything above keeps working without it).
3. Apply `0100_work_onsite_checks.sql` for the location trail and the on-site review queue (optional; off until switched on in Admin).
4. Deploy. The Worker's cron heartbeat already runs `sweepWork` (it also deletes old location trails).
5. In Admin, review the catalogue prices and the `work` settings, then approve providers as they register.

## Adding a service type (Fix, Laundry)

Insert rows into `work_services` with `type = 'fix'` or `'laundry'` (or use `POST /admin/services`) and add the
type to `serviceTypes`. Fix is mostly `quote` with a call-out fee; Laundry is mostly `fixed` per unit. Migration `0099` seeds a starting catalogue
for both, and the customer app's Fix and Laundry screens now book through this engine.

## Known gaps (deliberate for the first release)

- Payment is from the Peebee wallet. A customer with too little balance is asked to top up; paying a job
  directly by mobile money is not built.
- A provider who is assigned a quote job and never quotes leaves the customer to cancel (a late-cancel fee on the
  call-out fee may apply). There is no automatic re-matching yet.
- A quote the customer already accepted is refunded (not re-offered) if the provider then cancels.
- Chat is text only; no voice notes or attachments. Photos can't be deleted once added (kept as an audit trail).
- Live location shown to the customer is a point in time; the route history kept for on-site checks is for staff only.
- A flagged provider cannot reply to a flag in the app yet; staff contact them directly.
