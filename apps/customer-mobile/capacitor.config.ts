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
};

export default config;
