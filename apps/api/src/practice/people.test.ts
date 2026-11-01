import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { runInPractice } from "../db/practice-context.js";
import { applyDemoAccounts, demoPeopleOnly, isDemoUserId, realPeopleOnly, ridersForThisWorld, visibleHere } from "./people.js";

const MARKED = "bf5e24b2-0d64-4653-aeca-f987b7cda566";

afterEach(() => applyDemoAccounts([], false));

test("with no marked accounts the rules are the id-prefix rules", () => {
  applyDemoAccounts([], false);
  assert.equal(isDemoUserId(MARKED), false);
  assert.equal(isDemoUserId("demo-relay-01"), true);
  assert.ok(!realPeopleOnly("r.user_id").includes(" NOT IN "));
  assert.ok(!demoPeopleOnly("r.user_id").includes(" IN ("));
});

test("a marked account is a demo person: out of live, in practice and the sandbox", () => {
  applyDemoAccounts([MARKED], false);
  assert.equal(isDemoUserId(MARKED), true);
  assert.equal(visibleHere("live", MARKED), false);
  assert.equal(visibleHere("sandbox", MARKED), true);
  assert.equal(runInPractice(() => visibleHere("live", MARKED)), true);
  assert.ok(realPeopleOnly("r.user_id").includes(`r.user_id NOT IN ('${MARKED}')`));
  assert.ok(demoPeopleOnly("r.user_id").includes(`OR r.user_id IN ('${MARKED}')`));
});

test("a marked rider is not matched in the live platform", () => {
  applyDemoAccounts([MARKED], false);
  assert.ok(ridersForThisWorld("r.user_id").includes(`NOT IN ('${MARKED}')`));
});

test("a marked rider is matched in the sandbox platform", () => {
  applyDemoAccounts([MARKED], true);
  assert.ok(!ridersForThisWorld("r.user_id").includes(MARKED));
  assert.ok(ridersForThisWorld("r.user_id").includes("NOT LIKE 'demo-relay-%'"), "prefixed demo people are still left to their own demo");
});

test("a marked rider is matched in practice, next to the practice riders", () => {
  applyDemoAccounts([MARKED], false);
  const sql = runInPractice(() => ridersForThisWorld("r.user_id"));
  assert.ok(sql.includes("LIKE 'prac\\_%'") && sql.includes(`r.user_id IN ('${MARKED}')`));
});

test("an id with a quote cannot break out of the SQL", () => {
  applyDemoAccounts(["x'); DROP TABLE users; --"], false);
  assert.ok(realPeopleOnly("u.id").includes("'x''); DROP TABLE users; --'"));
});
