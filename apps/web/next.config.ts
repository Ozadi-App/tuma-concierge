import type { NextConfig } from "next";
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

const nextConfig: NextConfig = {
  output: "standalone",
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
