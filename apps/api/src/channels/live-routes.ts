import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { clientIp, consume, hashKey } from "../lib/ratelimit.js";
import { fail } from "./common.js";
import { createHelperCode, endLive, goLive, helperStreams, joinAsHelper, liveState, moderateLiveComment, myOpenLive, postLiveComment, startLive } from "./live.js";
import { optionalUser, viewerKey } from "./viewer.js";

/** Going live from a phone: the host's controls, the viewers' poll and comments, and the helper device. */
export const liveRoutes = new Hono();

const startSchema = z.object({ publisherType: z.string().max(20), publisherId: z.string().max(80), title: z.string().max(140).optional() });

liveRoutes.post("/live/start", requireAuth, async (c) => {
  try {
    const body = startSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_input", message: "Choose who is going live." }, 400);
    return c.json({ live: await startLive(c.get("user"), body.data) });
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.get("/live/mine", requireAuth, async (c) => {
  try {
    return c.json({ live: await myOpenLive(c.get("user").sub), streams: await helperStreams(c.get("user").sub) });
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/helper/join", requireAuth, async (c) => {
  try {
    const body = z.object({ code: z.string().max(12) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_input", message: "Enter the 6-digit code." }, 400);
    return c.json(await joinAsHelper(c.get("user"), body.data.code));
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/:id/go", requireAuth, async (c) => {
  try {
    return c.json({ live: await goLive(c.get("user"), c.req.param("id") as string) });
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/:id/end", requireAuth, async (c) => {
  try {
    return c.json(await endLive(c.get("user"), c.req.param("id") as string));
  } catch (err) {
    return fail(c, err);
  }
});

/** Open to anyone watching: the viewer count and the newest comments. A heartbeat (`beat=1`) keeps a viewer counted. */
liveRoutes.get("/live/:id/state", async (c) => {
  try {
    const user = await optionalUser(c);
    const key = await viewerKey(c, user);
    const gate = await consume(`live_state:${await hashKey(`${clientIp(c)}|${key}`)}`, 90, 60);
    if (!gate.allowed) return c.json({ error: "slow_down", message: "Too many refreshes." }, 429);
    const after = Math.max(0, Math.floor(Number(c.req.query("after") ?? 0)) || 0);
    return c.json(await liveState(c.req.param("id") as string, { userId: user?.id ?? null, key }, { after, beat: c.req.query("beat") === "1" }));
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/:id/comments", requireAuth, async (c) => {
  try {
    const body = z.object({ body: z.string().max(2000) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_input", message: "Write something first." }, 400);
    return c.json(await postLiveComment(c.get("user"), c.req.param("id") as string, body.data.body), 201);
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/:id/comments/:commentId/:action", requireAuth, async (c) => {
  try {
    const action = c.req.param("action");
    if (action !== "hide" && action !== "pin" && action !== "unpin") return c.json({ error: "not_found", message: "Not found." }, 404);
    const commentId = Number(c.req.param("commentId"));
    if (!Number.isInteger(commentId)) return c.json({ error: "invalid_input", message: "Not found." }, 400);
    return c.json(await moderateLiveComment(c.get("user"), c.req.param("id") as string, commentId, action));
  } catch (err) {
    return fail(c, err);
  }
});

liveRoutes.post("/live/:id/helper-code", requireAuth, async (c) => {
  try {
    return c.json(await createHelperCode(c.get("user"), c.req.param("id") as string));
  } catch (err) {
    return fail(c, err);
  }
});
