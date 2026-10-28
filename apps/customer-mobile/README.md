# customer-mobile — Android / iOS app for the customer app

The native apps ship their own copy of the customer UI (HTML, JS, CSS, icons,
images, demo clips). Only API calls go over the network.

**`apps/customer` (the PWA) is not modified by anything here.** This package
copies its source into `.stage/` on every build, adapts the *copy* for a static
export, and writes the result to `www/` (both git-ignored). Fix a bug or add a
screen in `apps/customer` and the next mobile build picks it up.

## Build the bundle

```bash
pnpm --filter customer-mobile build
```

The API URL comes from `apps/customer/.env.production` (or `NEXT_PUBLIC_API_URL`).
For a bundle that talks to a local API set `ALLOW_LOCAL_API=1`.

## Create / sync the native projects

```bash
cd apps/customer-mobile
pnpm build
pnpm exec cap add android      # once; needs Android Studio / SDK to build
pnpm exec cap add ios          # once; needs a Mac with Xcode + CocoaPods
pnpm exec cap sync
pnpm exec cap open android     # or: cap open ios
```

## What the build changes in the copy

`scripts/build.mjs` does, to `.stage/` only:

- Dynamic routes. A static export cannot contain `/orders/<id>` for ids that
  only exist at runtime, so every dynamic segment is exported once as `_` and
  the real values travel in the query string (`/orders/123/pay` →
  `/orders/_/pay?_p_id=123`). `native/` aliases `next/link` and
  `next/navigation` so pages keep using ordinary paths, `useParams()` and
  `usePathname()`. Each `[param]` folder gets a generated `layout.tsx`.
- The root layout's `<body>` contents are wrapped in a Suspense boundary
  (required to read the query string in a static export).
- `app/demo-video` (a server route) is dropped; the clips become plain files.
- `ServiceWorkerRegister`, `InstallPrompt` and `lib/push` are swapped for
  native-safe versions (`native/`): no service worker, no web push.
- Two relative paths into `packages/shared` get one more `../`. The build fails
  loudly if those lines (or the `<body>` tag) change, so drift never goes
  unnoticed.

Push-notification deep links, and any code that sets `window.location` to a
dynamic path, must go through `toNative()` from `native/routes.ts`.

## Not done yet

- Native push (FCM / APNs), background location, camera, other plugins.
- App icons / splash screens, signing, store listings.
- Verification on real devices: full-page loads of exported URLs
  (`window.location.href = ...`, practice mode) rely on the webview resolving
  `/login/` to `login/index.html`.
- The same treatment for the rider, merchant and other apps.
- UI updates only reach users with a new app release.

The API allows this app's origins (`https://app.peebee.local`,
`capacitor://app.peebee.local`) without any `CORS_ORIGINS` change.
