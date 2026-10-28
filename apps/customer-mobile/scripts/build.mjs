// Builds the static bundle that Capacitor copies into the Android/iOS apps.
//
//   pnpm --filter customer-mobile build
//
// apps/customer (the PWA) is never modified. This copies it into .stage/,
// adapts the copy for a static export, builds it, and writes apps/customer-mobile/www/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(here, "../customer");
const stage = path.join(here, ".stage");
const www = path.join(here, "www");

const envFile = path.join(source, ".env.production");
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? fs.readFileSync(envFile, "utf8").match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1];
if (!apiUrl || (/localhost|127\.0\.0\.1/.test(apiUrl) && process.env.ALLOW_LOCAL_API !== "1")) {
  console.error("NEXT_PUBLIC_API_URL must be the live API (it is baked into the bundle).\nFor a local test build set ALLOW_LOCAL_API=1.");
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(stage);

// 1. A copy of the PWA's source.
for (const entry of ["app", "components", "lib", "public", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs", ".env.production"]) {
  if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(stage, entry), { recursive: true });
}

// The copy sits one folder deeper than apps/customer, so its two relative paths
// into packages/shared need one more "../". Fail loudly if the originals change.
function patch(file, from, to) {
  const target = path.join(stage, file);
  const text = fs.readFileSync(target, "utf8");
  if (!text.includes(from)) throw new Error(`${file}: expected "${from}" — update scripts/build.mjs`);
  fs.writeFileSync(target, text.replaceAll(from, to));
}
patch("app/globals.css", "../../../packages/shared/", "../../../../packages/shared/");
patch("tailwind.config.ts", "../../packages/shared/", "../../../packages/shared/");

// The route params live in the query string, which a static export can only
// read behind a Suspense boundary: wrap the root layout's <body> contents.
{
  const target = path.join(stage, "app/layout.tsx");
  const text = fs.readFileSync(target, "utf8");
  const body = /(<body[^>]*>)([\s\S]*?)(<\/body>)/;
  if (!body.test(text)) throw new Error('app/layout.tsx: no <body> found — update scripts/build.mjs');
  fs.writeFileSync(
    target,
    `import { NativeBoundary } from "../native/NativeBoundary";\n` + text.replace(body, "$1<NativeBoundary>$2</NativeBoundary>$3"),
  );
}

// 2. Server-only routes and web-crawler metadata files cannot exist in a static
//    export. The demo clips become plain files at the same URL (step 6).
for (const serverOnly of ["app/demo-video", "app/robots.ts", "app/sitemap.ts"]) {
  fs.rmSync(path.join(stage, serverOnly), { recursive: true, force: true });
}

// 3. Every dynamic route is exported once with the placeholder "_" (see
//    native/routes.ts); each [param] folder gets a layout that says so.
function addPlaceholderLayouts(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const param = /^\[([^\].]+)\]$/.exec(entry.name)?.[1];
    if (param) {
      const layout = path.join(full, "layout.tsx");
      if (fs.existsSync(layout)) throw new Error(`${layout} already exists; merge generateStaticParams into it by hand`);
      fs.writeFileSync(
        layout,
        `export function generateStaticParams() {\n  return [{ ${param}: "_" }];\n}\n\nexport default function Layout({ children }: { children: React.ReactNode }) {\n  return children;\n}\n`,
      );
    }
    addPlaceholderLayouts(full);
  }
}
addPlaceholderLayouts(path.join(stage, "app"));

// 4. The mobile build config and shims.
fs.copyFileSync(path.join(here, "next.config.ts"), path.join(stage, "next.config.ts"));
fs.cpSync(path.join(here, "native"), path.join(stage, "native"), { recursive: true });

// 5. Build.
const status = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], {
  cwd: stage,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
}).status;
if (status !== 0) process.exit(status ?? 1);
fs.renameSync(path.join(stage, "www"), www);

// 6. The web app serves the demo clips through a range-aware route; in the
//    bundle they are ordinary files at the same URL. The service worker and
//    PWA install files are web-only.
fs.cpSync(path.join(source, "public/demo-video-src"), path.join(www, "demo-video"), { recursive: true });
fs.rmSync(path.join(www, "demo-video-src"), { recursive: true, force: true });
for (const f of ["sw.js", "manifest.json", "offline.html"]) fs.rmSync(path.join(www, f), { force: true });
console.log("\nMobile bundle ready in apps/customer-mobile/www");
