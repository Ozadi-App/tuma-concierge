# Env matrix (names only)

Per environment: `local` | `preview` | `staging` | `prod`

## Database
- `DATABASE_URL`

## MoMo (MTN / Airtel)
- `MOMO_BASE_URL`
- `MOMO_SUBSCRIPTION_KEY`
- `MOMO_API_USER`
- `MOMO_API_KEY`
- `MOMO_TARGET_ENV` (`sandbox` | `production`)
- `MOMO_CALLBACK_URL`

## Maps
- `MAPS_API_KEY` (server)
- Public map key only if required; restrict by HTTP referrer

## Storage (R2)
- `RIDER_DOCS` Worker R2 binding (private rider, order, chat, restaurant, and merchant KYC files)
- Optional S3-compatible keys only if a non-Worker process must access the bucket

## WebRTC TURN
- `TURN_URLS`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

## Push
- `PUSH_VAPID_PUBLIC_KEY`
- `PUSH_VAPID_PRIVATE_KEY`
- `PUSH_SUBJECT`

## App
- `JWT_SECRET` / `SESSION_SECRET`
- `CREDENTIALS_ENCRYPTION_KEY` (required to encrypt provider credentials and merchant settlement destinations)
- `CORS_ORIGINS`

## Demo / practice gate (production)
- `PEEBEE_DISABLE_DEMO=1` (API Worker var): forces `payments_demo_mode` off
  regardless of the admin setting, so mock payment providers can never stand
  in for real money. Unset or any other value = current behaviour.
- `NEXT_PUBLIC_PEEBEE_DISABLE_DEMO=1` (build-time, every Next.js app): turns
  off practice mode and its browser-local demo catalog (demo restaurants,
  marketplace stores/products); all requests go to the real API. Must be set
  when the app is **built**, since `NEXT_PUBLIC_*` values are inlined.
- Both default to off so staging, sandbox and the practice journeys keep
  working. Set both for production builds (see `infra/GO-LIVE.md`).
- Demo rows seeded by migrations (e.g. `0087_practice_demo_car_riders.sql`,
  `0088_demo_rideshare_drivers.sql`) are data, not code: remove or flag them
  in the production database separately.

Do not paste secret values into chat, issues, or commits.
