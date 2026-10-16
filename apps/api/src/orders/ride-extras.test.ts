import assert from "node:assert/strict";
import test from "node:test";
import { fareBand, rideQuote, routeDistanceKm, stopFeeTotal, validateOffer, validateStops, offerSummary } from "./ride-extras.js";

const pickup = { lat: 0.3136, lng: 32.5811 };
const stop = { lat: 0.33, lng: 32.59 };
const destination = { lat: 0.3476, lng: 32.6 };

test("route distance runs through every stop", () => {
  const direct = routeDistanceKm([pickup, destination]);
  const via = routeDistanceKm([pickup, stop, destination]);
  assert.ok(via >= direct);
  assert.equal(routeDistanceKm([pickup]), 0);
});

test("multi-stop quote = rounded distance fare + flat fee per stop", () => {
  const pricing = { ratePerKm: 1000, minimumFare: 2000, stopFee: 1000 };
  const single = rideQuote({ pickup, destination, stops: [] }, pricing);
  assert.equal(single.stopFees, 0);
  assert.equal(single.total, single.base);
  const multi = rideQuote({ pickup, destination, stops: [stop] }, pricing);
  assert.equal(multi.stopFees, 1000);
  assert.equal(multi.total, multi.base + 1000);
  assert.equal(multi.total % 500, 0);
  assert.equal(stopFeeTotal(2, 0), 0, "no fee when the setting is 0");
  assert.equal(stopFeeTotal(3, 800), 3 * 500, "fee rounds to the nearest UGX 500 like every fare");
});

test("fare band defaults to 70%–150% of the quote, rounded", () => {
  assert.deepEqual(fareBand(10000, { offerMinPercent: 70, offerMaxPercent: 150 }), { min: 7000, max: 15000 });
  const band = fareBand(3000, { offerMinPercent: 70, offerMaxPercent: 150 });
  assert.ok(band.min <= 3000 && band.max >= 3000);
});

test("offers are rounded and must stay in the band", () => {
  const band = { min: 7000, max: 15000 };
  assert.deepEqual(validateOffer(7200, band), { amount: 7000 });
  assert.ok("error" in validateOffer(6000, band));
  assert.ok("error" in validateOffer(16000, band));
  assert.ok("error" in validateOffer(0, band));
});

test("stops are capped, need a pinned route, and can't repeat the previous point", () => {
  assert.equal(validateStops([], 3, null, null), null);
  assert.equal(validateStops([stop], 3, pickup, destination), null);
  assert.match(validateStops([stop, stop, stop, stop], 3, pickup, destination)!, /at most 3/);
  assert.match(validateStops([stop], 0, pickup, destination)!, /aren't available/);
  assert.match(validateStops([stop], 3, null, destination)!, /Pin the pickup/);
  assert.match(validateStops([pickup], 3, pickup, destination)!, /Stop 1 is the same place/);
  assert.match(validateStops([destination], 3, pickup, destination)!, /last stop/);
});

test("offer summary reports expiry and raises left", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  const order = { fare_offer: 7000, fare_offer_quote: 9000, fare_offer_expires_at: "2026-10-16T11:59:00.000Z", fare_offer_raises: 2 };
  const s = offerSummary(order, { offerMinPercent: 70, offerMaxPercent: 150, maxRaises: 5 }, now)!;
  assert.equal(s.expired, true);
  assert.equal(s.raisesLeft, 3);
  assert.equal(s.min, 6000);
  assert.equal(offerSummary({ fare_offer: null }, { offerMinPercent: 70, offerMaxPercent: 150, maxRaises: 5 }), null);
});
