# The shared practice world

Practice runs against a **separate database**. Demo customers, riders, merchants, restaurants, stores and orders live there and only there, so practice data can never appear in live lists, statistics or payouts. Everyone who practises signs in as a demo persona (`prac_*` ids), never as themselves.

## How it works

- `POST /v1/practice/session {role}` signs the caller in as the persona for their app and returns a practice token (`prc` claim, 24 hours).
- `practice/scope.ts` sends every request that carries a practice token to the practice database (`db/practice-context.ts`). The routes are the live ones; only the rows differ.
- Inside practice the platform environment is always `sandbox`, so payments are mocked and no provider is ever called. Settings (rates, switches) are still read from the live database, so admin controls apply to practice too.
- Without a practice database, practice tokens are refused with 503. They are never answered from the live database.
- Demo customers place orders through the real API (`practice/demo-customers.ts`) on session start and every two minutes, so riders always have jobs and merchants and restaurants always have orders coming.

## One-time setup (done by hand, like migrations)

1. `wrangler d1 create peebee-practice`
2. Add to `apps/api/wrangler.jsonc` under `d1_databases`:
   ```jsonc
   { "binding": "PRACTICE_DB", "database_name": "peebee-practice", "database_id": "<id from step 1>", "migrations_dir": "src/db/migrations" }
   ```
3. `wrangler d1 migrations apply peebee-practice --remote` (and again after every new migration, alongside the live one).
4. Deploy, then Admin → Practice → **Lay down the practice world** (or just start a practice session; the first one seeds it).

Local development: set `PRACTICE_TURSO_DATABASE_URL` (and `PRACTICE_TURSO_AUTH_TOKEN`) to a separate libSQL database.

## Admin

`GET /v1/admin/practice` (status and counts), `POST /v1/admin/practice/seed`, `POST /v1/admin/practice/orders`, `POST /v1/admin/practice/reset` (wipes the practice database and re-seeds; live data is untouched).
