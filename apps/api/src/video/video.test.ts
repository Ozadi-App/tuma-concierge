import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.JWT_SECRET = "video-test-only-secret";

import { isPrivateHost, isSocialVideoPage, parsePublicHttpsUrl } from "./url-guard.js";
import { parseVideoConfig } from "./settings.js";
import { cloudinarySignature } from "./adapters/cloudinary.js";
import { bunnyUploadSignature } from "./adapters/bunny.js";
import { signServe, verifyServe } from "../ads/token.js";
import { parseAdsConfig } from "../ads/settings.js";
import { adPlan, creatorShareMilli, eventCostMilli } from "../ads/service.js";
import { buildVast } from "../ads/vast.js";

test("url guard: only public https addresses pass", () => {
  assert.ok(parsePublicHttpsUrl("https://cdn.example.com/v/clip.mp4"));
  for (const bad of [
    "http://cdn.example.com/a.mp4", "https://localhost/a.mp4", "https://127.0.0.1/a.mp4", "https://10.0.0.5/a.mp4",
    "https://192.168.1.1/a.mp4", "https://172.20.0.1/a.mp4", "https://169.254.169.254/latest/meta-data", "https://[::1]/a.mp4",
    "https://user:pw@cdn.example.com/a.mp4", "https://cdn.example.com:8443/a.mp4", "https://intranet/a.mp4", "https://2130706433/a.mp4",
    "https://service.internal/a.mp4", "not a url",
  ]) assert.equal(parsePublicHttpsUrl(bad), null, bad);
  assert.equal(isPrivateHost("example.com"), false);
  assert.ok(isSocialVideoPage(new URL("https://www.youtube.com/watch?v=x")));
  assert.ok(isSocialVideoPage(new URL("https://vm.tiktok.com/abc")));
  assert.equal(isSocialVideoPage(new URL("https://cdn.example.com/a.mp4")), false);
});

test("video config: bad values fall back and limits are clamped", () => {
  const d = parseVideoConfig("{}");
  assert.equal(d.enabled, false, "off by default");
  assert.equal(d.byoEnabled, false, "bring-your-own off by default");
  const c = parseVideoConfig(JSON.stringify({ enabled: true, maxDurationSeconds: 99999999, maxVideosPerDay: -4, platformProviders: ["mock", "link", "mux", "nope", "mux"], byoProviders: ["mock", "bunny"] }));
  assert.equal(c.maxDurationSeconds, 14400);
  assert.equal(c.maxVideosPerDay, 1);
  assert.deepEqual(c.platformProviders, ["mux"], "mock, link and unknown names are never platform providers");
  assert.deepEqual(c.byoProviders, ["bunny"], "the demo provider is never offered");
  assert.deepEqual(parseVideoConfig("garbage").platformProviders, ["cloudflare_stream"]);
});

test("provider signatures match their documented recipes", () => {
  const params = { public_id: "peebee/abc", timestamp: "1700000000" };
  const expected = createHash("sha1").update("public_id=peebee/abc&timestamp=1700000000SECRET").digest("hex");
  assert.equal(cloudinarySignature(params, "SECRET"), expected);
  // Fields Cloudinary says never to sign are left out.
  assert.equal(cloudinarySignature({ ...params, api_key: "k", resource_type: "video", file: "x" }, "SECRET"), expected);
  assert.equal(bunnyUploadSignature("12", "key", 1700000000, "guid"), createHash("sha256").update("12key1700000000guid").digest("hex"));
});

test("ad token: round trip, tamper and expiry", () => {
  const claims = { serve: "srv_1", campaign: "cmp_1", creative: "crv_1", asset: "vid_1", creator: "u1", viewer: "u2", slot: "preroll", exp: Math.floor(Date.now() / 1000) + 60 };
  const token = signServe(claims);
  assert.deepEqual(verifyServe(token), claims);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, creator: "u2" })).toString("base64url");
  assert.equal(verifyServe(`${forged}.${sig}`), null, "changed claims are rejected");
  assert.equal(verifyServe(`${body}.AAAA`), null);
  assert.equal(verifyServe("junk"), null);
  assert.equal(verifyServe(token, claims.exp + 1), null, "expired");
});

test("ads config: the creator share can never reach 100%", () => {
  assert.equal(parseAdsConfig('{"creatorSharePercent":100}').creatorSharePercent, 95);
  assert.equal(parseAdsConfig("{}").enabled, false);
  assert.equal(parseAdsConfig('{"skipAfterSeconds":-3}').skipAfterSeconds, 0);
});

test("ad plan: short and unknown-length videos", () => {
  const cfg = parseAdsConfig(JSON.stringify({ enabled: true, midrollEnabled: true, minVideoSeconds: 30, midrollEveryMinutes: 5, maxAdsPerView: 3 }));
  assert.deepEqual(adPlan(cfg, 20), { preroll: false, midrollAtSeconds: [] }, "too short for ads");
  assert.deepEqual(adPlan(cfg, null), { preroll: true, midrollAtSeconds: [] }, "unknown length: pre-roll only");
  assert.deepEqual(adPlan(cfg, 12 * 60), { preroll: true, midrollAtSeconds: [300, 600] });
  assert.deepEqual(adPlan(cfg, 5 * 60 + 10), { preroll: true, midrollAtSeconds: [] }, "no mid-roll in the last 30 seconds");
  assert.deepEqual(adPlan({ ...cfg, enabled: false }, 600), { preroll: false, midrollAtSeconds: [] });
});

test("ad pricing: each model charges on its own event and the share rounds down", () => {
  assert.equal(eventCostMilli("cpm", 20_000, "impression"), 20_000);
  assert.equal(eventCostMilli("cpm", 20_000, "complete"), 0);
  assert.equal(eventCostMilli("cpv", 50, "impression"), 0);
  assert.equal(eventCostMilli("cpv", 50, "complete"), 50_000);
  assert.equal(eventCostMilli("cpc", 300, "click"), 300_000);
  assert.equal(eventCostMilli("cpc", 300, "impression"), 0);
  assert.equal(creatorShareMilli(20_000, 55), 11_000);
  assert.equal(creatorShareMilli(7, 55), 3);
});

test("VAST: tracking points at signed beacons and text is escaped", () => {
  const xml = buildVast(
    { serveId: "srv_1", token: "TOKEN", slot: "preroll", creative: { kind: "video", mediaUrl: "https://ads.example.com/a.mp4?x=1&y=2", posterUrl: null, headline: "Fish & <chips>", ctaLabel: null, hasClickThrough: true, durationSeconds: 15, skipAfterSeconds: 5 } },
    "https://api.example.com",
  );
  assert.match(xml, /<VAST version="4.0">/);
  assert.match(xml, /https:\/\/api\.example\.com\/v1\/ads\/e\/TOKEN\/impression/);
  assert.match(xml, /event="firstQuartile"><!\[CDATA\[https:\/\/api\.example\.com\/v1\/ads\/e\/TOKEN\/q25/);
  assert.match(xml, /skipoffset="00:00:05"/);
  assert.match(xml, /<Duration>00:00:15<\/Duration>/);
  assert.match(xml, /Fish &amp; &lt;chips&gt;/);
  assert.match(xml, /v1\/ads\/click\/TOKEN/);
});
