import assert from "node:assert/strict";
import test from "node:test";
import { PaymentProviderError } from "../gateway.js";
import { momoPartyId, momoReference, mtnAdapter, safeProviderBody } from "./wire.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("momoReference turns a Peebee id into a stable UUID MTN accepts", async () => {
  const a = await momoReference("pay_abc123");
  assert.match(a, UUID);
  assert.equal(await momoReference("pay_abc123"), a, "a retry must send the same reference");
  assert.notEqual(await momoReference("pay_abc124"), a);
  const own = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(await momoReference(own.toUpperCase()), own, "an existing UUID is used as-is");
});

test("safeProviderBody masks phone numbers and bearer tokens", () => {
  assert.equal(safeProviderBody('{"payer":"256772345678"}'), '{"payer":"***678"}');
  assert.equal(safeProviderBody("Authorization: Bearer abc.def-ghi"), "Authorization: Bearer ***");
  assert.ok(safeProviderBody("x".repeat(1000)).length <= 300);
});

test("mtn adapter: UUID reference, cached token, right leg, 404-only fallback", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    MOMO_API_USER: "user-1", MOMO_API_KEY: "key-1",
    MOMO_COLLECTION_SUBSCRIPTION_KEY: "col-sub", MOMO_DISBURSEMENT_SUBSCRIPTION_KEY: "dis-sub",
  });
  const realFetch = globalThis.fetch;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let statusReply: (url: string) => Response = () => new Response(JSON.stringify({ status: "SUCCESSFUL" }), { status: 200 });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.endsWith("/token/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    if (init?.method === "POST") return new Response("", { status: 202 });
    return statusReply(url);
  }) as typeof fetch;
  try {
    const input = { referenceId: "pay_1", amount: 5000, currency: "EUR", narrative: "t", msisdn: "256772345678" };
    const res = await mtnAdapter.depositFunds(input);
    assert.match(res.transactionReference, UUID);
    const post = calls.find((c) => c.url.endsWith("/requesttopay"))!;
    assert.equal(post.headers["X-Reference-Id"], res.transactionReference);

    await mtnAdapter.depositFunds({ ...input, referenceId: "pay_2" });
    assert.equal(calls.filter((c) => c.url.endsWith("/collection/token/")).length, 1, "token reused while valid");

    calls.length = 0;
    await mtnAdapter.checkStatus(res.transactionReference, "", "disbursement");
    assert.ok(calls.every((c) => !c.url.includes("/collection/")), "known leg asks only that leg");

    calls.length = 0;
    statusReply = (url) => (url.includes("/collection/") ? new Response("nope", { status: 404 }) : new Response(JSON.stringify({ status: "FAILED" }), { status: 200 }));
    assert.equal((await mtnAdapter.checkStatus(res.transactionReference, "")).status, "FAILED", "404 on collections falls back to disbursements");

    statusReply = () => new Response("boom", { status: 500 });
    await assert.rejects(() => mtnAdapter.checkStatus(res.transactionReference, ""), /500/, "a real error is not masked by the fallback");
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("mtn adapter: international number, EUR only in the sandbox, and clear errors", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    MOMO_API_USER: "user-1", MOMO_API_KEY: "key-1",
    MOMO_COLLECTION_SUBSCRIPTION_KEY: "col-sub", MOMO_DISBURSEMENT_SUBSCRIPTION_KEY: "dis-sub",
  });
  delete process.env.MOMO_TARGET_ENV;
  const realFetch = globalThis.fetch;
  const realError = console.error;
  console.error = () => undefined;
  let postStatus = 202;
  let postBody = "";
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/token/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    if (init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(postBody, { status: postStatus });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(momoPartyId("0783335335"), "256783335335", "a local number goes to MTN in international form");
    assert.equal(momoPartyId("+256 783 335 335"), "256783335335");
    assert.equal(momoPartyId("46733123450"), "46733123450", "a non-Ugandan test number is left as digits");

    const input = { referenceId: "pay_cur", amount: 3500, currency: "UGX", narrative: "t", msisdn: "0783335335" };
    await mtnAdapter.depositFunds(input);
    assert.equal(bodies[0]?.currency, "EUR", "MTN's sandbox only takes EUR");
    assert.deepEqual(bodies[0]?.payer, { partyIdType: "MSISDN", partyId: "256783335335" });
    assert.equal(bodies[0]?.amount, "3500");

    process.env.MOMO_TARGET_ENV = "production";
    await mtnAdapter.depositFunds({ ...input, referenceId: "pay_cur2" });
    assert.equal(bodies[1]?.currency, "UGX", "production is charged in the order's own currency");
    delete process.env.MOMO_TARGET_ENV;

    postStatus = 400;
    postBody = '{"code":"INVALID_CURRENCY","message":"for 256783335335"}';
    await assert.rejects(() => mtnAdapter.depositFunds({ ...input, referenceId: "pay_bad" }), (err: unknown) => {
      assert.ok(err instanceof PaymentProviderError);
      assert.equal(err.code, "payment_provider_rejected");
      assert.ok(!err.clientMessage.includes("INVALID_CURRENCY"), "MTN's own reply never reaches the customer");
      assert.ok(err.upstreamMessage?.includes("400") && !err.upstreamMessage.includes("256783335335"), "the log line has MTN's reply, number masked");
      return true;
    });
    postStatus = 503;
    await assert.rejects(() => mtnAdapter.depositFunds({ ...input, referenceId: "pay_down" }), (err: unknown) => err instanceof PaymentProviderError && err.code === "payment_provider_unavailable");
  } finally {
    console.error = realError;
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
