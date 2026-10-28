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

## Build Android & iOS

### Android (`.apk`)

```bash
pnpm apk:customer
# Output: apps/customer-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS (`.app` / `.ipa`)

The native Xcode project lives in `apps/customer-mobile/ios/App`.

On a Mac with Xcode + CocoaPods:

```bash
pnpm --filter customer-mobile ios:simulator   # Simulator Debug .app
pnpm --filter customer-mobile ipa:unsigned    # Release iOS device build
cd apps/customer-mobile && pnpm exec cap open ios
```

On Windows / Linux (or in CI), `.github/workflows/customer-ios.yml` builds both the iOS Simulator `.app` and an unsigned `.ipa` on `macos-latest` and uploads them as workflow artifacts.

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

## Over-the-air updates (customer app, Android)

The APK carries its own copy of the screens, so a fix to `apps/customer` would not reach a phone until a new APK was
installed. The app therefore asks our own update server whether a newer copy of the screens is live, and switches to it.

How it fits together:

- **Phone** (`@capgo/capacitor-updater`, configured in `capacitor.config.ts`): when the app comes to the foreground it
  asks `POST /v1/app-updates/customer/check`, gets the list of files of the new copy, downloads only the files it does
  not already have (the ones inside the APK or from earlier updates are reused, matched by checksum), and switches to it the next time
  the app goes to the background. `native/ServiceWorkerRegister.tsx` tells the plugin the new copy started; if it does
  not, the plugin goes back to the last copy that worked (`appReadyTimeout`).
- **Server** (`apps/api/src/app-updates`): stores each file once, by its SHA-256, in the existing R2 bucket, plus a list of
  files per version; the versions, and which one is live, are kept in the `settings` table. No migration. It checks each
  upload against its checksum (the phone checks again), refuses a version without `index.html`, keeps the last ten
  versions and deletes files no kept version uses. A typical release downloads a few hundred KB, not the whole app.
- **Admin → App updates**: switch updates on or off, choose whether a new version goes live by itself, make any
  published version live (this is also how you roll back), delete old ones.
- **Pipeline** (`.github/workflows/customer-mobile-bundle.yml`): after each live deploy of `main` that changed the
  customer app, `packages/shared` or this folder, builds the screens and uploads the files the server does not have yet (`scripts/publish-app-update.mjs`). It does nothing until the
  repository secret below exists.

One-time setup:

1. Make a long random secret (24+ characters) and store it twice, with the same value: as the API worker's secret
   `APP_UPDATES_PUBLISH_TOKEN` (Cloudflare → Workers → peebee-api → Settings → Variables and Secrets) and as the
   repository secret of the same name (GitHub → Settings → Secrets and variables → Actions).
2. Build and install a new APK once, so the phone has the updater inside it:
   `pnpm install && pnpm --filter customer-mobile apk:debug`. Phones on an older APK cannot update themselves.
3. Run the workflow once by hand (Actions → Publish customer app update → Run workflow) or merge the next change.
   The version appears in Admin → App updates.

When a new APK is needed again: any change that needs something native (a new permission, plugin, `MainActivity`
changes, a Capacitor upgrade). Raise `minNativeVersionCode` in `update-compat.json` and `versionCode` in
`android/app/build.gradle` together, so phones on older builds are told to update the app instead of being sent
screens they cannot run.

Not covered: the files are protected by HTTPS, a checksum and the publish token, but they are not signed with a
separate key. Anyone holding the publish token, or write access to the R2 bucket, could change what phones run, so
treat both like production credentials.

## Native platform configuration

- **Origins**: `https://app.peebee.online` (Android) and `capacitor://app.peebee.online` (iOS), both allowed in `apps/api/src/app.ts` regardless of `CORS_ORIGINS`.
- **Android (`MainActivity.java`)**: Peebee launcher icons & splash screen, native Google Sign-In picker with popup WebView fallback, camera/microphone/location permissions.
- **iOS (`BridgeViewController` in `AppDelegate.swift`, `Info.plist`)**: Peebee 1024×1024 AppIcon & 2732×2732 LaunchScreen splash, in-app `WKWebView` popup window support for Google OAuth (`createWebViewWith` / `webViewDidClose`) with Mobile Safari User-Agent compatibility, edge-swipe back navigation, inline media playback, and camera/microphone/location/photo library usage descriptions.
