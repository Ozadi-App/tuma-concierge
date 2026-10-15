import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildEmailHtml, buildStaffInviteHtml } from "./email.js";

test("verify email has CTA, code and PNG logo", () => {
  const html = buildEmailHtml("123456", "https://api.example/v1/auth/verify/confirm-link?token=a&b=1");
  assert.match(html, /Verify Email Address/);
  assert.match(html, /1&nbsp;2&nbsp;3&nbsp;4&nbsp;5&nbsp;6/);
  assert.match(html, /token=a&amp;b=1/);
  assert.match(html, /peebee-logo-light\.png/);
  assert.doesNotMatch(html, /\.svg/);
});

test("reset email is code-only and worded for a reset", () => {
  const html = buildEmailHtml("654321", undefined, "reset");
  assert.match(html, /Reset your password/);
  assert.doesNotMatch(html, /Verify Email Address|finish setting up/);
});

test("staff invite escapes user-supplied values", () => {
  const html = buildStaffInviteHtml("<b>Eve</b>", "Admin", "p\"w<", "https://admin.example");
  assert.doesNotMatch(html, /<b>Eve/);
  assert.match(html, /&lt;b&gt;Eve/);
});
