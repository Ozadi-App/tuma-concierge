/**
 * MTN MoMo Open API client — direct integration, no aggregator in between.
 * Collections (customer -> escrow) and Disbursements (escrow -> rider).
 * Only used once its required credentials resolve (admin-entered via
 * ../credentials.ts, or the MOMO_* env vars as a fallback) — otherwise
 * ../service.ts routes to ./mock.ts instead.
 *
 * Supersedes the old apps/api/src/momo/client.ts (same API, wired into the
 * env-vars-only settings model that predates ../credentials.ts).
 *
 * Docs: https://momodeveloper.mtn.com/
 */

import { getCredential, isProviderConfigured } from "../credentials.js";
import type { GatewayChargeInput, GatewayResult, PaymentGatewayAdapter } from "../gateway.js";

type Product = "collection" | "disbursement";

export type MomoStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

async function baseUrl(): Promise<string> {
  return process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com";
}

async function targetEnv(): Promise<string> {
  return (await getCredential("mtn", "targetEnv")) ?? "sandbox";
}

async function subscriptionKey(product: Product): Promise<string> {
  const key =
    product === "collection"
      ? await getCredential("mtn", "collectionSubscriptionKey")
      : await getCredential("mtn", "disbursementSubscriptionKey");
  if (!key) throw new Error(`MTN MoMo ${product} subscription key is not set`);
  return key;
}

async function apiUser(product: Product): Promise<string> {
  // MTN ties an API user to the subscription key it was created under, so a
  // Disbursements-only user can be saved separately; it falls back to the shared one.
  const user =
    (product === "disbursement" ? await getCredential("mtn", "disbursementApiUser") : undefined) ??
    (await getCredential("mtn", "apiUser"));
  if (!user) throw new Error("MTN MoMo API user is not set");
  return user;
}

async function apiKey(product: Product): Promise<string> {
  const key =
    (product === "disbursement" ? await getCredential("mtn", "disbursementApiKey") : undefined) ??
    (await getCredential("mtn", "apiKey"));
  if (!key) throw new Error("MTN MoMo API key is not set");
  return key;
}

export function isMtnConfigured(): Promise<boolean> {
  return isProviderConfigured("mtn");
}

/** Keeps provider error bodies useful for support without writing phone numbers (or anything
 * token-shaped) into logs: digit runs of 7+ are masked down to their last 3 digits. */
export function safeProviderBody(text: string): string {
  return text
    .replace(/\+?\d{7,}/g, (m) => `***${m.slice(-3)}`)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
    .slice(0, 300);
}

class MomoHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MomoHttpError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MTN requires X-Reference-Id to be a UUID, but Peebee's own ids are not. A UUID is derived
 * deterministically from the Peebee id (SHA-256, formatted as a v5-style UUID), so a retry of the
 * same payment always sends the same reference and MTN de-duplicates it, and a status check can
 * recompute it. An id that is already a UUID is used unchanged. */
export async function momoReference(referenceId: string): Promise<string> {
  if (UUID_RE.test(referenceId)) return referenceId.toLowerCase();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`peebee-momo:${referenceId}`)));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Access tokens are reused for their valid lifetime (minus a safety margin) instead of being
// requested on every call, and never shared between products. Per-isolate only, and never logged.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_MARGIN_MS = 60_000;

async function getAccessToken(product: Product): Promise<string> {
  const user = await apiUser(product);
  const key = await apiKey(product);
  const subscription = await subscriptionKey(product);
  const base = await baseUrl();
  const cacheKey = `${product}|${base}|${user}|${key.length}|${key.slice(-4)}|${subscription.slice(-4)}`;
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.token;

  const res = await fetch(`${base}/${product}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${user}:${key}`)}`,
      "Ocp-Apim-Subscription-Key": subscription,
    },
  });
  if (!res.ok) {
    throw new MomoHttpError(`MoMo ${product} token request failed: ${res.status} ${safeProviderBody(await res.text())}`, res.status);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const lifetimeMs = Math.max(0, (data.expires_in ?? 0) * 1000 - TOKEN_MARGIN_MS);
  if (lifetimeMs > 0) tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + lifetimeMs });
  return data.access_token;
}

/** Drops cached tokens, e.g. after a 401 that means the cached one was revoked early. */
function forgetTokens(): void {
  tokenCache.clear();
}

/** Collections: RequestToPay — pulls funds from the customer's MoMo wallet into escrow. */
async function requestToPay(input: GatewayChargeInput): Promise<void> {
  if (!input.msisdn) throw new Error("MTN MoMo requires a resolved mobile money number");
  const token = await getAccessToken("collection");
  const res = await fetch(`${await baseUrl()}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": await momoReference(input.referenceId),
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("collection"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: input.currency,
      externalId: input.referenceId,
      payer: { partyIdType: "MSISDN", partyId: input.msisdn },
      payerMessage: input.narrative,
      payeeNote: input.narrative,
    }),
  });
  if (res.status !== 202) {
    if (res.status === 401) forgetTokens();
    throw new MomoHttpError(`MoMo requestToPay failed: ${res.status} ${safeProviderBody(await res.text())}`, res.status);
  }
}

async function getRequestToPayStatus(referenceId: string): Promise<MomoStatus> {
  const token = await getAccessToken("collection");
  const res = await fetch(`${await baseUrl()}/collection/v1_0/requesttopay/${await momoReference(referenceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("collection"),
    },
  });
  if (!res.ok) {
    throw new MomoHttpError(`MoMo requestToPay status failed: ${res.status} ${safeProviderBody(await res.text())}`, res.status);
  }
  const data = (await res.json()) as { status: MomoStatus };
  return data.status;
}

/** Disbursements: Transfer — pays the rider out of escrow at Settle. */
async function transfer(input: GatewayChargeInput): Promise<void> {
  if (!input.msisdn) throw new Error("MTN MoMo requires a resolved mobile money number");
  const token = await getAccessToken("disbursement");
  const res = await fetch(`${await baseUrl()}/disbursement/v1_0/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": await momoReference(input.referenceId),
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("disbursement"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: input.currency,
      externalId: input.referenceId,
      payee: { partyIdType: "MSISDN", partyId: input.msisdn },
      payerMessage: input.narrative,
      payeeNote: input.narrative,
    }),
  });
  if (res.status !== 202) {
    if (res.status === 401) forgetTokens();
    throw new MomoHttpError(`MoMo transfer failed: ${res.status} ${safeProviderBody(await res.text())}`, res.status);
  }
}

async function getTransferStatus(referenceId: string): Promise<MomoStatus> {
  const token = await getAccessToken("disbursement");
  const res = await fetch(`${await baseUrl()}/disbursement/v1_0/transfer/${await momoReference(referenceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("disbursement"),
    },
  });
  if (!res.ok) {
    throw new MomoHttpError(`MoMo transfer status failed: ${res.status} ${safeProviderBody(await res.text())}`, res.status);
  }
  const data = (await res.json()) as { status: MomoStatus };
  return data.status;
}

function mapStatus(status: MomoStatus): GatewayResult["status"] {
  if (status === "SUCCESSFUL") return "SUCCEEDED";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

export const mtnAdapter: PaymentGatewayAdapter = {
  key: "mtn",
  displayName: "MTN MoMo (direct)",
  // Both the collections and disbursements subscription keys are required
  // fields (see ../credentials.ts) — MTN approves each product separately,
  // so this only reports "configured" once both are in, which is what
  // lets resolveProvider() safely route a rider payout here too.
  isConfigured: isMtnConfigured,
  supportsDisbursement: true,
  requiresNetwork: false,
  async depositFunds(input): Promise<GatewayResult> {
    await requestToPay(input);
    return { status: "PENDING", transactionReference: await momoReference(input.referenceId) };
  },
  async withdrawFunds(input): Promise<GatewayResult> {
    await transfer(input);
    return { status: "PENDING", transactionReference: await momoReference(input.referenceId) };
  },
  async checkStatus(transactionReference, _createdAt, operationType): Promise<GatewayResult> {
    // Collections and disbursements are separate reference spaces on MTN's side. When the caller
    // knows the leg we ask only that one; otherwise try collections and fall back to
    // disbursements only when MTN says the reference is unknown there (404). Any other error
    // (network, auth, 5xx) is a real failure and is surfaced instead of being masked.
    const check = async (leg: "collection" | "disbursement") =>
      mapStatus(leg === "collection" ? await getRequestToPayStatus(transactionReference) : await getTransferStatus(transactionReference));
    if (operationType === "disbursement") return { status: await check("disbursement"), transactionReference };
    if (operationType === "collection" || operationType === "refund") return { status: await check("collection"), transactionReference };
    try {
      return { status: await check("collection"), transactionReference };
    } catch (err) {
      if (!(err instanceof MomoHttpError) || err.status !== 404) throw err;
      return { status: await check("disbursement"), transactionReference };
    }
  },
};
