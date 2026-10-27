# Migrations to apply by hand

The deploy does not run migrations. Apply these to the live D1 database, in this order, before turning the matching
options on in Admin → Settings → Commerce options. The code keeps working without them (it falls back or answers
`503 migration_pending`), but the new behaviour stays unavailable until they are applied.

| File | What it enables |
| --- | --- |
| `apps/api/src/db/migrations/0137_storefront_hardening.sql` | Web storefront: custom-domain ownership, loyalty, section content, SMS log, ad-pixel settings |
| `apps/api/src/db/migrations/0138_digital_fulfillment.sql` | Digital products: hashed access tokens, licence-key pool, file links, refunds |
| `apps/api/src/db/migrations/0139_lms_hardening.sql` | LMS: enrolment rules, course listing, certificates, email log |
| `apps/api/src/db/migrations/0140_services_hardening.sql` | Services: opening hours, days off, booking codes and seats, online payments and refunds |
| `apps/api/src/db/migrations/0141_merchant_portal.sql` | Merchant sign-up website: per-store "listed in the app" and "web store" switches, and where a merchant registered |
| `apps/api/src/db/migrations/0143_merchant_plans.sql` | Merchant plans: marks every existing store as keeping its current access, and records which plan a subscription bought |

Each file is safe to read before running: they only add tables, columns and indexes. Run them one at a time and check
the Admin → Commerce options page — an option whose migration is missing is shown as unavailable and cannot be chosen.

Known shared numbers (`0012`, `0013`, `0042`, `0043`, `0090`, `0107`, `0132`) pre-date this list and are already
applied; do not rename them. `src/db/migrations.test.ts` stops any new number being reused.
