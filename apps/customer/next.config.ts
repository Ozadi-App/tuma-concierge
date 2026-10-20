import type { NextConfig } from "next";
// Plain .mjs shared by all three apps — see that file for what the policy
// does and doesn't cover.
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

const nextConfig: NextConfig = {
  ...(process.env.STANDALONE ? { output: "standalone" } : {}),
  transpilePackages: ["@peebee/shared"],
  images: {
    unoptimized: true,
  },
  // Peebee Jobs is now Peebee Hire; links already sent (notifications, bookmarks) keep working.
  async redirects() {
    return [
      // The customer app moved from customer.peebee.online to app.peebee.online. Same path and query, so every old
      // link still works. Temporary (307) until the move has settled; switch to permanent after that.
      {
        source: "/:path*",
        has: [{ type: "host", value: "customer.peebee.online" }],
        destination: "https://app.peebee.online/:path*",
        permanent: false,
      },
      { source: "/services/jobs", destination: "/services/hire", permanent: true },
      { source: "/services/jobs/:path*", destination: "/services/hire/:path*", permanent: true },
    ];
  },
  async headers() {
    return securityHeaderRules({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      dev: process.env.NODE_ENV === "development",
    });
  },
  webpack(config) {
    // @peebee/shared uses explicit ".js" extensions on relative imports (required by
    // its NodeNext consumer, apps/api) even though the files are ".ts" — teach
    // webpack to resolve those the way Node's ESM loader does.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
