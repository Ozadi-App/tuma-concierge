import { patchSchema } from "../lib/patch-schema.js";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { clientIp, consume, hashKey } from "../lib/ratelimit.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { addCauseUpdate, closeCause, createCause, donate, getCauseBySlug, liveCauses, myCauses, PUBLIC_CAUSE_STATUSES, refreshDonation, releaseCause, requireCauses, serializeCause, submitCause, updateCause } from "./causes.js";
import { ChannelsError, fail } from "./common.js";
import { optionalUser, originOf } from "./viewer.js";

/** Causes: the creator's tools, and the public pages anyone can open and give on without an account. */
export const causesRoutes = new Hono();

const causeSchema = z.object({
  title: z.string().max(140),
  story: z.string().max(8000),
  coverPath: z.string().max(400).nullable().optional(),
  beneficiary: z.string().max(160).optional(),
  goalUgx: z.number(),
  days: z.number(),
  fundingMode: z.string().max(20).optional(),
});

causesRoutes.get("/creator/causes", requireAuth, async (c) => {
  try {
    await requireCauses();
    const rows = await myCauses(c.get("user").sub);
    return c.json({ causes: await Promise.all(rows.map((r) => serializeCause(r, originOf(c), { owner: true }))) });
  } catch (err) {
    return fail(c, err);
  }
});

causesRoutes.post("/creator/causes", requireAuth, async (c) => {
  try {
    const body = causeSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the details and try again.", 400);
    const cause = await createCause(c.get("user").sub, body.data);
    return c.json({ cause: await serializeCause(cause, originOf(c), { owner: true }) }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

causesRoutes.patch("/creator/causes/:id", requireAuth, async (c) => {
  try {
    const body = patchSchema(causeSchema).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the details and try again.", 400);
    const cause = await updateCause(c.get("user").sub, c.req.param("id") as string, body.data);
    return c.json({ cause: await serializeCause(cause, originOf(c), { owner: true }) });
  } catch (err) {
    return fail(c, err);
  }
});

causesRoutes.post("/creator/causes/:id/submit", requireAuth, async (c) => {
  try {
    const cause = await submitCause(c.get("user").sub, c.req.param("id") as string);
    return c.json({ cause: await serializeCause(cause, originOf(c), { owner: true }) });
  } catch (err) {
    return fail(c, err);
  }
});

causesRoutes.post("/creator/causes/:id/close", requireAuth, async (c) => {
  try {
    await closeCause(c.get("user").sub, c.req.param("id") as string);
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

causesRoutes.post("/creator/causes/:id/updates", requireAuth, async (c) => {
  try {
    const body = z.object({ body: z.string().max(2000) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Write an update.", 400);
    await addCauseUpdate(c.get("user").sub, c.req.param("id") as string, body.data.body);
    return c.json({ ok: true }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

/** Moves money raised into the creator's balance (they must be verified). */
causesRoutes.post("/creator/causes/:id/release", requireAuth, async (c) => {
  try {
    const body = z.object({ amountUgx: z.number().optional() }).safeParse(await c.req.json().catch(() => ({})));
    return c.json(await releaseCause(c.get("user").sub, c.req.param("id") as string, body.success ? body.data.amountUgx : undefined));
  } catch (err) {
    return fail(c, err);
  }
});

// ----------------------------------------------------------------------- public

causesRoutes.get("/public/causes", async (c) => {
  try {
    await requireCauses();
    c.header("Cache-Control", "public, max-age=30");
    const rows = await liveCauses(30);
    return c.json({ causes: await Promise.all(rows.map((r) => serializeCause(r, originOf(c)))) });
  } catch (err) {
    return fail(c, err);
  }
});

/** A cause page. Works with no sign-in and no app. Drafts and unapproved causes are visible only to their owner. */
causesRoutes.get("/public/causes/:slug", async (c) => {
  try {
    await requireCauses();
    const user = await optionalUser(c);
    const cause = await getCauseBySlug(c.req.param("slug") as string);
    const mine = !!user && !!cause && cause.owner_id === user.id;
    if (!cause || (!PUBLIC_CAUSE_STATUSES.includes(cause.status) && !mine) || (cause.environment !== (await getPlatformEnvironment()) && !mine)) throw new ChannelsError("not_found", "This cause was not found.", 404);
    c.header("Cache-Control", mine ? "private, no-store" : "public, max-age=15");
    return c.json({ cause: await serializeCause(cause, originOf(c), { owner: mine }) });
  } catch (err) {
    return fail(c, err);
  }
});

const donateSchema = z.object({
  amountUgx: z.number(),
  tipUgx: z.number().optional(),
  name: z.string().max(80).optional(),
  anonymous: z.boolean().optional(),
  message: z.string().max(400).optional(),
  method: z.enum(["wallet", "momo"]),
  msisdn: z.string().max(20).optional(),
});

causesRoutes.post("/public/causes/:slug/donate", async (c) => {
  try {
    const user = await optionalUser(c);
    const limit = await consume(`donate:${await hashKey(clientIp(c))}`, 10, 600);
    if (!limit.allowed) throw new ChannelsError("rate_limited", "Too many attempts. Please wait a few minutes.", 429);
    const body = donateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the details and try again.", 400);
    const r = await donate({ slug: c.req.param("slug") as string, donorId: user?.id ?? null, ...body.data });
    return c.json(r, 201);
  } catch (err) {
    return fail(c, err);
  }
});

/** A donor's receipt. The code is the only credential, so guests can come back to it. */
causesRoutes.get("/public/donations/:code", async (c) => {
  try {
    const limit = await consume(`donation-status:${await hashKey(clientIp(c))}`, 120, 600);
    if (!limit.allowed) throw new ChannelsError("rate_limited", "Too many checks. Please wait.", 429);
    c.header("Cache-Control", "no-store");
    return c.json(await refreshDonation(c.req.param("code") as string));
  } catch (err) {
    return fail(c, err);
  }
});
