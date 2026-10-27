import type { CapacitorConfig } from "@capacitor/cli";

// The app ships its own copy of the web UI (webDir, built by
// `pnpm build:mobile`); only API calls go over the network.
const config: CapacitorConfig = {
  appId: "online.peebee.customer",
  appName: "Peebee",
  webDir: "www",
  server: {
    // The bundle is served locally, but the webview still needs an origin for
    // CORS. The API allows exactly these (apps/api/src/app.ts):
    //   Android  https://app.peebee.local      iOS  capacitor://app.peebee.local
    hostname: "app.peebee.local",
    androidScheme: "https",
  },
};

export default config;
