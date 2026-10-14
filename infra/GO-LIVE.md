# Production go-live checklist

Production stays blocked until Sharon signs off (see README). Work through
every item below and record who checked it and when. Never paste secret
values into this file, chat, issues or commits.

## 1. Code and CI
- [ ] `main` CI green: typecheck (all apps), API tests, builds (all apps), `pnpm audit --prod` clean.
- [ ] Security changes merged (gas hardening, pharmacy hardening, payment callback replay protection).
- [ ] No open PR touching payments, wallet, ledger or auth is half-merged.

## 2. Database (Cloudflare D1)
- [ ] Separate production D1 database; never point production at the staging DB.
- [ ] All migrations in `apps/api/src/db/migrations` applied in order. Migrations marked
      "APPLY BY HAND BEFORE DEPLOYING" (e.g. `0096_gas_security.sql`, `0097_pharmacy_security.sql`)
      applied **before** the code that needs them; `0098_payment_callback_events.sql` applied.
- [ ] Demo/practice rows seeded by migrations (e.g. `0087`, `0088`) removed or disabled in production data.
- [ ] Backups: D1 Time Travel window confirmed, plus a scheduled export; restore tested once.

## 3. Secrets and config (`wrangler secret put`, see `infra/ENV.md`)
- [ ] `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`: fresh, production-only, high-entropy values.
- [ ] `CORS_ORIGINS` lists production app domains only (no staging, no localhost).
- [ ] `PEEBEE_DISABLE_DEMO=1` on the API Worker.
- [ ] `NEXT_PUBLIC_PEEBEE_DISABLE_DEMO=1` set at **build** time for every Next.js app.
- [ ] Push VAPID keys, TURN credentials, maps keys (referrer-restricted), R2 bindings set for production.
- [ ] Google OAuth client has production redirect origins only.

## 4. Payments (mobile money)
- [ ] Live merchant accounts approved: MTN MoMo (`MOMO_TARGET_ENV=production`), Airtel, Yo!, Flutterwave as applicable.
- [ ] Admin setting `payments_demo_mode` is `0` (also forced off by `PEEBEE_DISABLE_DEMO`).
- [ ] Yo! callback sends the `X-Peebee-Callback-Token` header (query `?token=` is no longer accepted);
      `YO_CALLBACK_SECRET` set. Flutterwave `verif-hash` secret set.
- [ ] Callback URLs are public HTTPS on the production API domain.
- [ ] End-to-end live test with a small real amount per rail: collect, refund/reversal, payout/settlement.
- [ ] Ledger reconciliation run and balances match provider statements.

## 5. Security
- [ ] Admin accounts reviewed; least privilege; 2FA on Cloudflare, GitHub, payment dashboards.
- [ ] GitHub branch protection on `main` (required CI, review).
- [ ] Rate limiting on auth, OTP/verification and payment endpoints (Cloudflare rules).
- [ ] Private R2 data (KYC, prescriptions) not publicly readable.

## 6. Operations
- [ ] Monitoring/alerting: Worker errors, 5xx rate, failed payments, stuck pending payments.
- [ ] Log retention set; logs contain no secrets or tokens.
- [ ] Rollback path tested (`wrangler rollback` / previous version).
- [ ] On-call contact and incident runbook (`infra/RUNBOOK.md`) up to date.

## 7. Legal and support
- [ ] Terms and privacy pages (apps/web) reviewed for Uganda (incl. Data Protection and Privacy Act 2019).
- [ ] Pharmacy: licensed-pharmacist verification and prescription handling reviewed.
- [ ] Customer support channel and refund policy published.

## Sign-off
- [ ] Sharon approves go-live. Date: ________
