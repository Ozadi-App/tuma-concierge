import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// This file is copied into .stage/ next to a copy of apps/customer by
// scripts/build.mjs; apps/customer itself is never touched.

/** Every page under app/, split into fixed routes and dynamic ones
 * ("/orders/[id]"), so the build can route around the dynamic ones. */
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

// Web-only modules swapped for native-safe ones.
const replacements: Record<string, string> = {
  "components/ServiceWorkerRegister": "native/ServiceWorkerRegister.tsx",
  "components/InstallPrompt": "native/InstallPrompt.tsx",
  "lib/push": "native/push.ts",
};

const nextConfig: NextConfig = {
  output: "export",
  // /orders/_/pay/index.html rather than /orders/_/pay.html, so the native
  // webview resolves a directory URL to a file.
  trailingSlash: true,
  distDir: "www",
  env: { NEXT_PUBLIC_NATIVE_ROUTES: JSON.stringify(scanRoutes(path.join(__dirname, "app"))) },
  images: { unoptimized: true },
  // Lint and type checks already run against apps/customer in CI; this is a copy of it.
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@peebee/shared"],
  webpack(config, { webpack }) {
    // @peebee/shared uses explicit ".js" extensions on relative imports (required by
    // its NodeNext consumer, apps/api) even though the files are ".ts" — teach
    // webpack to resolve those the way Node's ESM loader does.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    // Route every in-app link and navigation through the dynamic-route shim.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "next/link$": path.join(__dirname, "native/link.tsx"),
      "next/navigation$": path.join(__dirname, "native/navigation.ts"),
    };
    // Server components (the pages that call redirect()) keep the real module.
    config.module.rules.push({
      issuerLayer: "rsc",
      resolve: { alias: { "next/navigation$": "next/dist/api/navigation.react-server.js" } },
    });
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^\.{1,2}\/.*(ServiceWorkerRegister|InstallPrompt|push)$/, (resource: {
        request: string;
        context: string;
      }) => {
        const abs = path.resolve(resource.context, resource.request);
        for (const [original, replacement] of Object.entries(replacements)) {
          if (abs === path.join(__dirname, original)) resource.request = path.join(__dirname, replacement);
        }
      }),
    );
    return config;
  },
};

export default nextConfig;
