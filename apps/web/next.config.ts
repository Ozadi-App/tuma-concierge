import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

/**
 * Old partner links go to their dedicated page: cars to car owners, TaxiPress and
 * Relay to taxis, fuel and stations to boda riders (fuel vouchers). A long-parcel link belongs with Buy.
 */
const toPartner: [string, string][] = [
  ["cars", "car-owner"], ["car", "car-owner"], ["taxipress", "taxi"], ["taxi-press", "taxi"],
  ["fuel", "boda"], ["stations", "boda"], ["station", "boda"], ["relay", "taxi"],
];
const toBuy = ["long-parcel", "long-parcels", "relay-parcel"];
/** Short addresses for pages that live inside a door. The fifth door is Work now; /hive is its old name. */
const toPage: [string, string][] = [
  ["/spotlight", "/buy/spotlight"],
  ["/pharmacy", "/buy/pharmacy"],
  ["/parcels", "/ride/parcels"],
  ["/parcel", "/ride/parcels"],
  ["/hive", "/work"],
  ["/hive/:path*", "/work/:path*"],
];

const nextConfig: NextConfig = {
  output: "standalone",
  // The shared CSS and header rules live above this folder, so the build root is the repo root.
  turbopack: { root: path.join(__dirname, "../..") },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      // Checked before the page files, so "/" on the sign-up host shows the portal and not the Peebee home page.
      beforeFiles: [
        // The merchant sign-up website: https://stores.peebee.online -> /portal (the same pages also answer at /portal).
        { source: "/", has: [{ type: "host", value: "stores\\.peebee\\.online" }], destination: "/portal" },
        { source: "/:page(register|login|dashboard)", has: [{ type: "host", value: "stores\\.peebee\\.online" }], destination: "/portal/:page" },
      ],
      afterFiles: [
        // Dedicated Merchant Storefront: https://[store-name].peebee.online -> /site/[store-name]
        // Excludes reserved Peebee platform subdomains (www, app, customer, rider, merchant, admin, api, etc.)
        {
          source: "/",
          has: [
            {
              type: "host",
              value:
                "(?<store>(?!www$|app$|customer$|rider$|merchant$|admin$|api$|food$|gas$|pharmacy$|partner$|sales$|work$|learn$|tv$|preview$|stores$|portal$)[a-z0-9-]+)\\.peebee\\.online",
            },
          ],
          destination: "/site/:store",
        },
      ],
    };
  },
  async redirects() {
    return [
      ...toPartner.flatMap(([s, d]) => [
        { source: `/${s}`, destination: `/partners/${d}`, permanent: true },
        { source: `/partners/${s}`, destination: `/partners/${d}`, permanent: true },
      ]),
      ...toBuy.map((s) => ({ source: `/${s}`, destination: "/buy", permanent: true })),
      ...toPage.map(([source, destination]) => ({ source, destination, permanent: true })),
      { source: "/partners/long-parcel", destination: "/buy", permanent: true },
    ];
  },
  async headers() {
    return securityHeaderRules({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      dev: process.env.NODE_ENV === "development",
      // Merchants may connect their own Meta / TikTok pixel on their public store.
      adPixels: true,
    });
  },
};

export default nextConfig;
