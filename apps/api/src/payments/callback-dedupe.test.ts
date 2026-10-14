import assert from "node:assert/strict";
import test from "node:test";
import { callbackEventKey, claimCallbackEvent, releaseCallbackEvent } from "./callback-dedupe.js";

function fakeStore() {
  const rows = new Set<string>();
  return async ({ sql, args }: { sql: string; args: (string | number)[] }) => {
    const key = `${args[0]}|${args[1]}`;
    if (sql.startsWith("INSERT")) {
      if (rows.has(key)) return { rowsAffected: 0 };
      rows.add(key);
      return { rowsAffected: 1 };
    }
    return { rowsAffected: rows.delete(key) ? 1 : 0 };
  };
}

test("yo event key combines transaction id and status", () => {
  assert.equal(callbackEventKey("yo", { TransactionReference: "T1", TransactionStatus: "SUCCEEDED" }), "T1:succeeded");
  assert.equal(callbackEventKey("yo", { NetworkRef: "N9", TransactionReference: "T1" }), "N9:-");
  assert.equal(callbackEventKey("yo", {}), "");
});

test("flutterwave event key uses data.id and status", () => {
  assert.equal(callbackEventKey("flutterwave", { data: { id: 42, tx_ref: "r", status: "successful" } }), "42:successful");
  assert.equal(callbackEventKey("flutterwave", { data: {} }), "");
  assert.equal(callbackEventKey("flutterwave", null), "");
});

test("replayed callback is reported as duplicate", async () => {
  const exec = fakeStore();
  assert.equal(await claimCallbackEvent("yo", "T1:succeeded", "T1", exec), "new");
  assert.equal(await claimCallbackEvent("yo", "T1:succeeded", "T1", exec), "duplicate");
  assert.equal(await claimCallbackEvent("flutterwave", "T1:succeeded", "T1", exec), "new");
  assert.equal(await claimCallbackEvent("yo", "T1:failed", "T1", exec), "new");
});

test("released claim can be processed again (provider retry after failure)", async () => {
  const exec = fakeStore();
  await claimCallbackEvent("yo", "k", "r", exec);
  await releaseCallbackEvent("yo", "k", exec);
  assert.equal(await claimCallbackEvent("yo", "k", "r", exec), "new");
});

test("missing table fails open", async () => {
  const exec = async () => {
    throw new Error("no such table");
  };
  assert.equal(await claimCallbackEvent("yo", "k", "r", exec), "unavailable");
});
