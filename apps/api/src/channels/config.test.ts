import test from "node:test";
import assert from "node:assert/strict";
import { CHANNELS_FIELDS, DEFAULT_CHANNELS_CONFIG, mergeChannelsConfig, parseGiftOptions, sanitizeChannelsConfig } from "@peebee/shared";

test("channels config: defaults are complete, stable and safe", () => {
  assert.deepEqual(sanitizeChannelsConfig(DEFAULT_CHANNELS_CONFIG), DEFAULT_CHANNELS_CONFIG, "sanitising the defaults changes nothing");
  assert.deepEqual(sanitizeChannelsConfig(null), DEFAULT_CHANNELS_CONFIG);
  const paths = new Set(CHANNELS_FIELDS.map((f) => f.path));
  assert.equal(paths.size, CHANNELS_FIELDS.length, "no duplicate settings");
  // Money, identity and fundraising features ship off until the business is licensed.
  const c = DEFAULT_CHANNELS_CONFIG;
  assert.equal(c.enabled, false);
  assert.equal(c.monetization.enabled, false);
  assert.equal(c.causes.enabled, false);
  assert.equal(c.rewards.enabled, false);
  assert.equal(c.kyc.withdrawalsEnabled, false);
  // The agreed starting values.
  assert.deepEqual([c.monetization.membershipCutPercent, c.monetization.payPerViewCutPercent, c.monetization.tipCutPercent, c.causes.donationCutPercent], [15, 20, 10, 0]);
  assert.equal(c.rewards.rateLock, "at_earn");
  assert.equal(c.causes.defaultFundingMode, "keep");
  assert.equal(c.kyc.minAgeToWithdraw, 18);
  assert.equal(c.general.minAge, 13);
  assert.equal(c.general.channelsOpen, true);
  assert.deepEqual(c.publishing.postTypes, ["video", "image", "carousel", "text"], "live and audio start off");
  assert.equal(c.kyc.required, true);
});

test("channels config: patches merge, clamp and cannot contradict themselves", () => {
  const next = mergeChannelsConfig(DEFAULT_CHANNELS_CONFIG, { monetization: { enabled: true, tipCutPercent: 12 }, causes: { allowAllOrNothing: false, defaultFundingMode: "all_or_nothing" } });
  assert.equal(next.monetization.enabled, true);
  assert.equal(next.monetization.tipCutPercent, 12);
  assert.equal(next.monetization.membershipCutPercent, 15, "untouched settings keep their values");
  assert.equal(next.causes.defaultFundingMode, "keep", "all-or-nothing cannot be the default while it is not allowed");
  const wild = sanitizeChannelsConfig({ kyc: { minWithdrawUgx: 5_000_000, maxWithdrawUgx: 10 }, rewards: { rateLock: "never", pointsPerQualifiedView: 1e9 } });
  assert.ok(wild.kyc.maxWithdrawUgx >= wild.kyc.minWithdrawUgx);
  assert.equal(wild.rewards.rateLock, "at_earn");
  assert.equal(wild.rewards.pointsPerQualifiedView, 100);
});

test("channels config: the gift menu parses leniently", () => {
  assert.deepEqual(parseGiftOptions("Rose:1000, Star:5000,Bad,Free:0,Crown:abc"), [{ name: "Rose", priceUgx: 1000 }, { name: "Star", priceUgx: 5000 }]);
});
