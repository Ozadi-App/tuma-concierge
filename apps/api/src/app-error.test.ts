import assert from "node:assert/strict";
import test from "node:test";
import app from "./app.js";
import { signToken } from "./auth/jwt.js";

test("a server error tells a signed-in admin what failed, and everyone else only the plain message", async () => {
  process.env.JWT_SECRET = "app-error-test-secret";
  // No database is attached in this test, so any route that reads it throws.
  const admin = await app.request("/v1/admin/stats", { headers: { Authorization: `Bearer ${await signToken({ sub: "a", role: "admin" })}` } });
  const adminBody = (await admin.json()) as { error: string; message: string };
  assert.equal(admin.status, 500);
  assert.equal(adminBody.error, "internal_error");
  assert.match(adminBody.message, /^Server error \(admin only\):.*\/v1\/admin\/stats/);

  const anon = await app.request("/v1/admin/stats");
  assert.ok(anon.status === 401 || anon.status === 500);
  if (anon.status === 500) assert.equal(((await anon.json()) as { message: string }).message, "Something went wrong on our end. Please try again in a moment.");
});
