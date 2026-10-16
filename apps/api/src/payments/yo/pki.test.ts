import assert from "node:assert/strict";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { signatureBase, signWithdraw } from "./pki.js";

const fields = {
  apiUsername: "100123",
  amount: "5000",
  account: "256771234567",
  narrative: "Rider payout",
  externalReference: "pay_abc",
  nonce: "nonce-1",
};

function verify(publicPem: string, data: string, sigB64: string): boolean {
  const v = createVerify("RSA-SHA1");
  v.update(data);
  return v.verify(createPublicKey(publicPem), Buffer.from(sigB64, "base64"));
}

test("signatureBase concatenates in the documented order, no password", () => {
  assert.equal(signatureBase(fields), "1001235000256771234567Rider payoutpay_abcnonce-1");
});

test("signatureBase truncates narrative, reference and nonce to 255 chars", () => {
  const long = "x".repeat(300);
  const base = signatureBase({ ...fields, narrative: long, externalReference: long, nonce: long });
  assert.equal(base.length, "100123".length + "5000".length + "256771234567".length + 255 * 3);
});

for (const encoding of ["pkcs8", "pkcs1"] as const) {
  test(`signs RSA-SHA1 verifiably from a ${encoding} PEM`, async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: encoding, format: "pem" }).toString();
    const sig = await signWithdraw(pem, fields);
    const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
    assert.ok(verify(pub, signatureBase(fields), sig));
    assert.ok(!verify(pub, signatureBase({ ...fields, amount: "5001" }), sig));
  });
}

test("a single-line pasted PEM still works", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, " ");
  assert.ok((await signWithdraw(pem, fields)).length > 100);
});

test("garbage and encrypted keys are rejected", async () => {
  await assert.rejects(() => signWithdraw("not a key", fields));
  await assert.rejects(() => signWithdraw("-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----", fields));
});
