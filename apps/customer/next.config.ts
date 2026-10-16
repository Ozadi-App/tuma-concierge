import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
// Plain .mjs shared by all three apps — see that file for what the policy
// does and doesn't cover.
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

// MOBILE_BUILD=1 produces the static bundle that ships inside the Android and
// iOS apps (see mobile/README.md). The web build below is unchanged.
const mobile = process.env.MOBILE_BUILD === "1";

/** Every page under app/, split into fixed routes and dynamic ones
 * ("/orders/[id]"), so the mobile build can route around the dynamic ones. */
function scanRoutes(dir: string, base = ""): { dynamic: string[]; static: string[] } {
  const out = { dynamic: [] as string[], static: [] as string[] };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = scanRoutes(path.join(dir, entry.name), `${base}/${entry.name}`);
      out.dynamic.push(...sub.dynamic);
      out.static.push(...sub.static);
    } else if (entry.name === "page.tsx") {
      (base.includes("[") ? out.dynamic : out.static).push(base || "/");
    }
  }
  return out;
}

const nextConfig: NextConfig = {
  ...(mobile
    ? {
        output: "export",
        // /orders/_/pay/index.html rather than /orders/_/pay.html, so the
        // native webview resolves a directory URL to a file.
        trailingSlash: true,
        distDir: "www",
        env: {
          NEXT_PUBLIC_NATIVE: "1",
          NEXT_PUBLIC_NATIVE_ROUTES: JSON.stringify(scanRoutes(path.join(__dirname, "app"))),
        },
      }
    : {
        output: "standalone",
        async headers() {
          return securityHeaderRules({
            apiUrl: process.env.NEXT_PUBLIC_API_URL,
            dev: process.env.NODE_ENV === "development",
          });
        },
      }),
  transpilePackages: ["@peebee/shared"],
  images: {
    unoptimized: true,
  },
  webpack(config) {
    // @peebee/shared uses explicit ".js" extensions on relative imports (required by
    // its NodeNext consumer, apps/api) even though the files are ".ts" — teach
    // webpack to resolve those the way Node's ESM loader does.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    if (mobile) {
      // Route every in-app link and navigation through the dynamic-route shim.
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "next/link$": path.join(__dirname, "lib/native/link.tsx"),
        "next/navigation$": path.join(__dirname, "lib/native/navigation.ts"),
      };
      // Server components (the pages that call redirect()) keep the real module.
      config.module.rules.push({
        issuerLayer: "rsc",
        resolve: { alias: { "next/navigation$": "next/dist/api/navigation.react-server.js" } },
      });
    }
    return config;
  },
};

export default nextConfig;
