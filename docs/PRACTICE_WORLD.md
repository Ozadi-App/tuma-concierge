# The shared practice world

Practice and Sandbox are the same thing seen two ways, on **one database**: demo customers, riders, merchants, restaurants, stores, menus and orders, all tagged `sandbox`.

- **Sandbox** (Admin → Platform state) is the whole platform looking at that data. Everyone sees it.
- **Practice** is one person, on a live platform, looking at the same data. They sign in as a demo persona; their real account, wallet and history are never touched.

Admin → Practice has a switch for each (the platform switch is on Platform state; "practice mode" lets users opt in themselves).

## How it works

- `POST /v1/practice/session {role}` signs the caller in as the persona for their app (`prac_cust_amina`, `prac_rider_1`, `prac_mu_pe_lakeside_mart`, `prac_ro_lakeview`) and returns a practice token (24 hours). The first session lays the world down.
- `practice/scope.ts` runs every request carrying a practice token with the platform environment forced to `sandbox` (`db/practice-context.ts`). Same routes, same rules, the sandbox rows. Payments are mocked and demo drivers run, as in sandbox.
- Demo people use `prac_` ids. `practice/people.ts` keeps them apart from real ones: rider matching and rider notifications use only demo riders inside practice and only real riders outside it; admin lists and counts hide demo people unless the admin is viewing the sandbox.
- Demo customers place real orders through the API (`practice/demo-customers.ts`): when a session starts, on the two-minute cron, or from Admin → Practice. Orders waiting for riders and food orders waiting for restaurants are topped up, so there is always something to take, prepare or sell.
- Admin settings (rates, switches, Services) still apply: settings are read once, from the same table.

## Admin

`GET /v1/admin/practice` (counts), `POST /v1/admin/practice/seed` (adds anything missing), `POST /v1/admin/practice/orders`, `POST /v1/admin/practice/reset` (clears demo orders, chats, payments and money, restores demo balances; shops and people stay; real data is untouched).

## No setup

No second database, no binding and no migration. Demo businesses reuse an existing merchant category (an inactive one is created only if there are none), so nothing new shows in any list a real merchant chooses from.
