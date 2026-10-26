import type { NextConfig } from "next";
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Dedicated Merchant Storefront: https://[store-name].peebee.online -> /site/[store-name]
      // Excludes reserved Peebee platform subdomains (www, app, customer, rider, merchant, admin, api, etc.)
      {
        source: "/",
        has: [
          {
            type: "host",
            value:
              "(?<store>(?!www$|app$|customer$|rider$|merchant$|admin$|api$|food$|gas$|pharmacy$|partner$|sales$|work$|learn$|tv$|preview$)[a-z0-9-]+)\\.peebee\\.online",
          },
        ],
        destination: "/site/:store",
      },
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
