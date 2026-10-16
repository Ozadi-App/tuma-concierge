// Builds the static bundle that Capacitor copies into the Android/iOS apps.
//
//   NEXT_PUBLIC_API_URL=https://api.peebee.online node scripts/build-mobile.mjs
//
// Output: apps/customer/www/
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl || /localhost|127\.0\.0\.1/.test(apiUrl)) {
  if (process.env.ALLOW_LOCAL_API !== "1") {
    console.error("Set NEXT_PUBLIC_API_URL to the live API (it is baked into the bundle).\nFor a local test build, also set ALLOW_LOCAL_API=1.");
    process.exit(1);
  }
}

// A static export has no server, so server-only routes cannot be part of it.
// The demo clips are plain files instead (copied below).
const serverOnly = path.join(root, "app/demo-video");
const parked = path.join(root, ".mobile-parked-demo-video");
fs.rmSync(path.join(root, "www"), { recursive: true, force: true });
fs.renameSync(serverOnly, parked);
let status = 1;
try {
  status = spawnSync("pnpm", ["exec", "next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, MOBILE_BUILD: "1" },
  }).status ?? 1;
} finally {
  fs.renameSync(parked, serverOnly);
}
if (status !== 0) process.exit(status);

// The web app serves these through the range-aware route; in the bundle they
// are ordinary files at the same URL.
fs.cpSync(path.join(root, "public/demo-video-src"), path.join(root, "www/demo-video"), { recursive: true });
// The service worker and PWA install files are web-only.
for (const f of ["sw.js", "manifest.json", "offline.html"]) fs.rmSync(path.join(root, "www", f), { force: true });
fs.rmSync(path.join(root, "www/demo-video-src"), { recursive: true, force: true });
console.log("\nMobile bundle ready in apps/customer/www");
