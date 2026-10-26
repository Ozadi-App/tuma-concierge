import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { baseMimeType } from "../lib/mime.js";
import { consume } from "../lib/ratelimit.js";
import { ChannelsError, fail, requireChannels } from "./common.js";
import { addPayoutAccount, kycState, listPayoutAccounts, moveToWallet, refreshWithdrawal, removePayoutAccount, submitKyc, withdraw, withdrawalOverview } from "./kyc.js";
import { IMAGE_TYPES, saveKycDocument } from "./media.js";
import { earningsSummary } from "./money.js";
import { cashOut, rewardsSummary, settleAdShare } from "./rewards.js";

/**
 * A creator's money and identity: earnings, rewards, verification, payout accounts and withdrawals.
 * Verification is only ever asked for here, when someone wants cash out.
 */
export const creatorRoutes = new Hono();

creatorRoutes.get("/creator/earnings", requireAuth, async (c) => {
  try {
    await requireChannels();
    await settleAdShare(c.get("user").sub).catch((e) => console.error("ad share settle failed:", e));
    return c.json(await earningsSummary(c.get("user").sub));
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.get("/creator/rewards", requireAuth, async (c) => {
  try {
    return c.json(await rewardsSummary(c.get("user").sub));
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.post("/creator/rewards/cashout", requireAuth, async (c) => {
  try {
    const body = z.object({ points: z.number().int().positive().optional() }).safeParse(await c.req.json().catch(() => ({})));
    return c.json(await cashOut(c.get("user").sub, body.success ? body.data.points : undefined));
  } catch (err) {
    return fail(c, err);
  }
});

// ------------------------------------------------------------------- verification

creatorRoutes.get("/creator/kyc", requireAuth, async (c) => {
  try {
    return c.json(await kycState(c.get("user").sub, await requireChannels()));
  } catch (err) {
    return fail(c, err);
  }
});

/** One ID photo or selfie. Stored privately; only staff reviewing the check can ever see it. */
creatorRoutes.post("/creator/kyc/documents", requireAuth, bodyLimit({ maxSize: 16 * 1024 * 1024, onError: (c) => c.json({ error: "file_too_large", message: "That photo is too large." }, 413) }), async (c) => {
  try {
    const cfg = await requireChannels();
    const user = c.get("user");
    const limit = await consume(`kyc-doc:${user.sub}`, 20, 3600);
    if (!limit.allowed) throw new ChannelsError("rate_limited", "Too many uploads. Try again later.", 429);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ChannelsError("missing_file", "Choose a photo.", 400);
    const type = baseMimeType(file.type);
    if (!IMAGE_TYPES.includes(type)) throw new ChannelsError("unsupported_file_type", "Use a JPG, PNG or WebP photo.", 400);
    if (!file.size || file.size > cfg.kyc.maxDocumentMb * 1024 * 1024) throw new ChannelsError("file_too_large", `Photos can be up to ${cfg.kyc.maxDocumentMb} MB.`, 413);
    return c.json({ key: await saveKycDocument(user.sub, file, type) }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

const kycSchema = z.object({
  fullName: z.string().max(100),
  idType: z.string().max(30),
  idNumber: z.string().max(40),
  dateOfBirth: z.string().max(12),
  idFrontKey: z.string().max(300),
  idBackKey: z.string().max(300).nullable().optional(),
  selfieKey: z.string().max(300).nullable().optional(),
});

creatorRoutes.post("/creator/kyc", requireAuth, async (c) => {
  try {
    const body = kycSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the details and try again.", 400);
    return c.json(await submitKyc(c.get("user").sub, body.data), 201);
  } catch (err) {
    return fail(c, err);
  }
});

// ---------------------------------------------------------------- payout & cash out

creatorRoutes.get("/creator/payout-accounts", requireAuth, async (c) => {
  try {
    await requireChannels();
    return c.json({ accounts: await listPayoutAccounts(c.get("user").sub) });
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.post("/creator/payout-accounts", requireAuth, async (c) => {
  try {
    const body = z.object({ msisdn: z.string().max(20), accountName: z.string().max(100) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the details and try again.", 400);
    return c.json({ account: await addPayoutAccount(c.get("user").sub, body.data) }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.delete("/creator/payout-accounts/:id", requireAuth, async (c) => {
  try {
    await removePayoutAccount(c.get("user").sub, c.req.param("id") as string);
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

/** The whole withdraw screen: balance, verification state, accounts, limits, recent payouts. */
creatorRoutes.get("/creator/withdrawals", requireAuth, async (c) => {
  try {
    return c.json(await withdrawalOverview(c.get("user").sub));
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.post("/creator/withdrawals", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const limit = await consume(`creator-withdraw:${user.sub}`, 10, 3600);
    if (!limit.allowed) throw new ChannelsError("rate_limited", "Too many attempts. Try again later.", 429);
    const body = z.object({ amountUgx: z.number(), payoutAccountId: z.string().max(80) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the amount and account.", 400);
    return c.json(await withdraw(user.sub, body.data), 201);
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.post("/creator/withdrawals/:id/refresh", requireAuth, async (c) => {
  try {
    await requireChannels();
    return c.json(await refreshWithdrawal(c.get("user").sub, c.req.param("id") as string));
  } catch (err) {
    return fail(c, err);
  }
});

creatorRoutes.post("/creator/move-to-wallet", requireAuth, async (c) => {
  try {
    const body = z.object({ amountUgx: z.number() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Enter an amount.", 400);
    return c.json(await moveToWallet(c.get("user").sub, body.data.amountUgx));
  } catch (err) {
    return fail(c, err);
  }
});
