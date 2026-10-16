# Customer app — Android / iOS (Capacitor)

The native apps ship their own copy of the UI (HTML, JS, CSS, icons, images,
demo clips). Only API calls go over the network.

## Build the bundle

```bash
pnpm --filter customer build:mobile      # uses NEXT_PUBLIC_API_URL from .env.production
```

Output is `apps/customer/www/` (git-ignored). The web build (`pnpm build`,
`pnpm deploy`) is unchanged; `MOBILE_BUILD=1` switches `next.config.ts` to a
static export. For a bundle that talks to a local API, set `NEXT_PUBLIC_API_URL`
and `ALLOW_LOCAL_API=1`.

## Create / sync the native projects

```bash
cd apps/customer
pnpm exec cap add android      # once; needs Android Studio / SDK to build
pnpm exec cap add ios          # once; needs a Mac with Xcode + CocoaPods
pnpm build:mobile && pnpm exec cap sync
pnpm exec cap open android     # or: cap open ios
```

## How dynamic routes work in the bundle

A static export cannot contain `/orders/<id>` pages for ids that only exist at
runtime. In the mobile build every dynamic segment is exported once as `_` and
the real values travel in the query string (`/orders/123/pay` →
`/orders/_/pay?_p_id=123`). `lib/native/` aliases `next/link` and
`next/navigation` so pages keep using ordinary paths, `useParams()` and
`usePathname()`; none of the page code changes. Each dynamic folder has a
`layout.tsx` that exports the `_` placeholder (harmless on the web build).

Push-notification deep links and any code that calls `window.location` with a
dynamic path must go through `toNative()` from `lib/native/routes.ts`.

## Not done yet

- Native push (FCM / APNs) — the web-push path is disabled in the bundle.
- Background location, camera and other plugins.
- App icons / splash screens, signing, store listings.
- Verification on real devices: full-page loads of exported URLs
  (`window.location.href = ...`, practice mode) rely on the webview resolving
  `/login/` to `login/index.html`.
- The same treatment for the rider, merchant and other apps.
- UI updates only reach users with a new app release.

The API allows the app's origins (`https://app.peebee.local`,
`capacitor://app.peebee.local`) without any `CORS_ORIGINS` change.
