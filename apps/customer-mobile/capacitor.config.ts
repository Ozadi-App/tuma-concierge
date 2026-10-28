import type { CapacitorConfig } from "@capacitor/cli";

// The app ships its own copy of the web UI (webDir, built by
// `pnpm build:mobile`); only API calls go over the network.
const config: CapacitorConfig = {
  appId: "online.peebee.customer",
  appName: "Peebee",
  webDir: "www",
  server: {
    // The bundle is served locally by Capacitor, using the app.peebee.online
    // origin so Google Identity Services and the live API CORS policy accept it
    // immediately.
    hostname: "app.peebee.online",
    androidScheme: "https",
  },
  plugins: {
    // Over-the-air updates from our own server (apps/api/src/app-updates), not a third-party service.
    // When the app comes to the foreground it asks the API whether a newer copy of the screens is live, downloads it
    // in the background and switches to it the next time the app goes to the background. If a new copy does not report
    // that it started (see native/ServiceWorkerRegister.tsx) the plugin goes back to the last copy that worked.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: "https://api.peebee.online/v1/app-updates/customer/check",
      // No statistics go anywhere, and channels are not used.
      statsUrl: "",
      channelUrl: "https://api.peebee.online/v1/app-updates/customer/channel",
      appReadyTimeout: 20000,
      // A newer APK starts from its own built-in screens again.
      resetWhenUpdate: true,
    },
  },
};

export default config;
