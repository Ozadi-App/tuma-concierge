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

## Native platform configuration

- **Origins**: `https://app.peebee.online` (Android) and `capacitor://app.peebee.online` (iOS), both allowed in `apps/api/src/app.ts` regardless of `CORS_ORIGINS`.
- **Android (`MainActivity.java`)**: Peebee launcher icons & splash screen, native Google Sign-In picker with popup WebView fallback, camera/microphone/location permissions.
- **iOS (`BridgeViewController` in `AppDelegate.swift`, `Info.plist`)**: Peebee 1024×1024 AppIcon & 2732×2732 LaunchScreen splash, in-app `WKWebView` popup window support for Google OAuth (`createWebViewWith` / `webViewDidClose`) with Mobile Safari User-Agent compatibility, edge-swipe back navigation, inline media playback, and camera/microphone/location/photo library usage descriptions.
