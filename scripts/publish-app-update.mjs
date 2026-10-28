#!/usr/bin/env node
// Publishes a built app folder to the update server (apps/api/src/app-updates): hashes every file, uploads only the
// ones the server does not have yet, then publishes the list. A release that changed little uploads little.
//
// node scripts/publish-app-update.mjs <app> <folder> <id> [--label "text"] [--min-native 2]
// Env: API_URL, APP_UPDATES_PUBLISH_TOKEN
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const [app, folder, id, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const api = (process.env.API_URL ?? "").replace(/\/$/, "");
const token = process.env.APP_UPDATES_PUBLISH_TOKEN ?? "";
if (!app || !folder || !id || !api || !token) {
  console.error("usage: publish-app-update.mjs <app> <folder> <id> [--label text] [--min-native n]  (needs API_URL and APP_UPDATES_PUBLISH_TOKEN)");
  process.exit(2);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const files = walk(folder).map((path) => {
  const bytes = readFileSync(path);
  return { path: relative(folder, path).split(sep).join("/"), bytes, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length };
});

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${api}/v1/app-updates/${app}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// Which checksums does the server lack? (40 per call.)
const unique = [...new Map(files.map((f) => [f.sha256, f])).values()];
const missing = new Set();
for (let i = 0; i < unique.length; i += 40) {
  const chunk = unique.slice(i, i + 40).map((f) => f.sha256);
  const answer = await call("POST", "files/missing", JSON.stringify({ hashes: chunk }), { "Content-Type": "application/json" });
  for (const sha of answer.missing) missing.add(sha);
}
const toSend = unique.filter((f) => missing.has(f.sha256));
console.log(`${files.length} files, ${toSend.length} new to the server (${(toSend.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1)} MB)`);

// Upload the new ones, a few at a time.
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < toSend.length) {
    const file = toSend[next++];
    for (let attempt = 1; ; attempt++) {
      try { await call("PUT", `files/${file.sha256}`, file.bytes, { "Content-Type": "application/octet-stream" }); break; }
      catch (error) { if (attempt === 3) throw error; await new Promise((r) => setTimeout(r, attempt * 1500)); }
    }
  }
}));

const result = await call("POST", "publish", JSON.stringify({
  id,
  label: flag("--label"),
  minNative: flag("--min-native") ? Number(flag("--min-native")) : undefined,
  files: files.map(({ path, sha256, size }) => ({ path, sha256, size })),
}), { "Content-Type": "application/json" });
console.log(JSON.stringify(result));
