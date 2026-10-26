import { Hono } from "hono";
import { z } from "zod";
import { CHANNELS_FIELDS, CHANNELS_SECTIONS } from "@peebee/shared";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { clientIp } from "../lib/ratelimit.js";
import { hasTable } from "../lib/schema.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";
import { freezeCause, refundCause, reviewCause, serializeCause, getCauseById, type CauseRow } from "./causes.js";
import { ageOn, reviewKyc } from "./kyc.js";
import { ChannelsError, channelsReady, fail, type Row } from "./common.js";
import { moderatePost, getPost } from "./posts.js";
import { describePublishers, publisherKey } from "./publishers.js";
import { addRate, currentRate, listRates, voidPoints } from "./rewards.js";
import { getChannelsConfig, saveChannelsConfig } from "./settings.js";
import { originOf } from "./viewer.js";

/** Admin: Channels settings, review queues (posts, reports, verification, causes), rewards rates and oversight. */
export const channelsAdminRoutes = new Hono();

const base = [requireAuth, requireRole("admin")] as const;
const settingsGate = [...base, requirePermission("settings.manage")] as const;
const viewGate = [...base, requirePermission("channels.view")] as const;
const moderateGate = [...base, requirePermission("channels.moderate")] as const;
const kycGate = [...base, requirePermission("channels.kyc")] as const;
const causesGate = [...base, requirePermission("channels.causes")] as const;

const count = async (sql: string, args: Array<string | number> = []) => Number(((await db.execute({ sql, args })).rows[0] as Row | undefined)?.n ?? 0);

channelsAdminRoutes.get("/admin/channels", ...viewGate, async (c) => {
  const ready = await channelsReady();
  const tables = {
    money: (await hasTable("creator_balances")) && (await hasTable("creator_kyc")),
    causes: (await hasTable("causes")) && (await hasTable("donations")),
    rewards: (await hasTable("reward_rates")) && (await hasTable("creator_points")),
  };
  const stats = ready
    ? {
        channels: await count("SELECT COUNT(*) AS n FROM channels"),
        suspendedChannels: await count("SELECT COUNT(*) AS n FROM channels WHERE status = 'suspended'"),
        postsPublished: await count("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'"),
        postsInReview: await count("SELECT COUNT(*) AS n FROM posts WHERE status = 'review'"),
        openReports: await count("SELECT COUNT(*) AS n FROM post_reports WHERE status = 'open'"),
        kycPending: tables.money ? await count("SELECT COUNT(*) AS n FROM creator_kyc WHERE status = 'pending'") : 0,
        causesWaiting: tables.causes ? await count("SELECT COUNT(*) AS n FROM causes WHERE status = 'submitted'") : 0,
        liveCauses: tables.causes ? await count("SELECT COUNT(*) AS n FROM causes WHERE status = 'live'") : 0,
        withdrawalsPending: tables.money ? await count("SELECT COUNT(*) AS n FROM creator_withdrawals WHERE status = 'pending'") : 0,
        creatorBalancesUgx: tables.money ? await count("SELECT COALESCE(SUM(available_ugx), 0) AS n FROM creator_balances") : 0,
        rewardPointsOutstanding: tables.rewards ? await count("SELECT COALESCE(SUM(points), 0) AS n FROM creator_points") : 0,
      }
    : null;
  return c.json({ migrationApplied: ready, tables, stats, currentRateUgxPer1000: tables.rewards ? await currentRate() : 0 });
});

// ------------------------------------------------------------------- settings

channelsAdminRoutes.get("/admin/channels/config", ...viewGate, async (c) => {
  return c.json({ config: await getChannelsConfig(), fields: CHANNELS_FIELDS, sections: CHANNELS_SECTIONS });
});

channelsAdminRoutes.put("/admin/channels/config", ...settingsGate, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);
  const { before, after } = await saveChannelsConfig(body);
  await logActivity({ actor: c.get("user"), action: "channels.config.update", entityType: "settings", entityId: "channels_config", summary: "Updated Channels settings", before, after, ip: clientIp(c) });
  return c.json({ config: after });
});

// ---------------------------------------------------------------- reward rates

channelsAdminRoutes.get("/admin/channels/rates", ...viewGate, async (c) => {
  return c.json({ rates: (await listRates()).map((r) => ({ id: String(r.id), effectiveFrom: String(r.effective_from), ugxPer1000Points: Number(r.ugx_per_1000_points), note: (r.note as string) ?? null })), currentUgxPer1000: await currentRate() });
});

channelsAdminRoutes.post("/admin/channels/rates", ...settingsGate, async (c) => {
  try {
    const body = z.object({ effectiveFrom: z.string().max(40), ugxPer1000Points: z.number(), note: z.string().max(200).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Check the date and rate.", 400);
    const id = await addRate({ ...body.data, createdBy: c.get("user").sub });
    await logActivity({ actor: c.get("user"), action: "channels.rate.add", entityType: "reward_rate", entityId: id, summary: `Set the reward rate to UGX ${body.data.ugxPer1000Points} per 1,000 points from ${body.data.effectiveFrom}`, after: body.data, ip: clientIp(c) });
    return c.json({ id }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

channelsAdminRoutes.post("/admin/channels/points/void", ...moderateGate, async (c) => {
  try {
    const body = z.object({ userId: z.string().max(80), points: z.number().int().positive(), reason: z.string().min(3).max(200) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Give the person, the points and a reason.", 400);
    await voidPoints(body.data.userId, body.data.points);
    await logActivity({ actor: c.get("user"), action: "channels.points.void", entityType: "user", entityId: body.data.userId, summary: `Voided ${body.data.points} reward points: ${body.data.reason}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

// --------------------------------------------------------------- posts & reports

channelsAdminRoutes.get("/admin/channels/posts", ...viewGate, async (c) => {
  if (!(await channelsReady())) return c.json({ posts: [] });
  const status = ["review", "published", "removed", "scheduled", "draft"].includes(c.req.query("status") ?? "") ? (c.req.query("status") as string) : "review";
  const rows = (await db.execute({ sql: "SELECT * FROM posts WHERE status = ? ORDER BY updated_at DESC LIMIT 100", args: [status] })).rows as Row[];
  const pubs = await describePublishers(rows.map((r) => ({ type: String(r.publisher_type), id: String(r.publisher_id) })));
  return c.json({
    posts: rows.map((r) => ({
      id: String(r.id), type: String(r.type), caption: (r.caption as string) ?? "", status: String(r.status), access: String(r.access), reportCount: Number(r.report_count),
      publisher: pubs.get(publisherKey(String(r.publisher_type), String(r.publisher_id)))?.name ?? String(r.publisher_type), publisherType: String(r.publisher_type),
      removedReason: (r.removed_reason as string) ?? null, createdAt: String(r.created_at),
    })),
  });
});

channelsAdminRoutes.post("/admin/channels/posts/:id/moderate", ...moderateGate, async (c) => {
  try {
    const body = z.object({ action: z.enum(["approve", "remove"]), reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose approve or remove.", 400);
    if (body.data.action === "remove" && !body.data.reason?.trim()) throw new ChannelsError("reason_required", "Give a reason for removing a post.", 400);
    const id = c.req.param("id") as string;
    const before = await getPost(id);
    const post = await moderatePost(id, body.data.action, body.data.reason);
    await logActivity({ actor: c.get("user"), action: `channels.post.${body.data.action}`, entityType: "post", entityId: id, summary: `${body.data.action === "approve" ? "Approved" : "Removed"} a post${body.data.reason ? `: ${body.data.reason}` : ""}`, before: { status: before?.status }, after: { status: post.status }, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

channelsAdminRoutes.get("/admin/channels/reports", ...viewGate, async (c) => {
  if (!(await channelsReady())) return c.json({ reports: [] });
  const status = c.req.query("status") === "all" ? null : "open";
  const rows = (await db.execute({
    sql: `SELECT r.id, r.reason, r.details, r.status, r.created_at, p.id AS post_id, p.caption, p.type, p.status AS post_status, p.report_count, p.publisher_type, p.publisher_id
          FROM post_reports r JOIN posts p ON p.id = r.post_id ${status ? "WHERE r.status = 'open'" : ""} ORDER BY r.created_at DESC LIMIT 100`,
    args: [],
  })).rows as Row[];
  return c.json({ reports: rows.map((r) => ({ id: String(r.id), reason: String(r.reason), details: (r.details as string) ?? null, status: String(r.status), createdAt: String(r.created_at), post: { id: String(r.post_id), caption: (r.caption as string) ?? "", type: String(r.type), status: String(r.post_status), reportCount: Number(r.report_count), publisherType: String(r.publisher_type), publisherId: String(r.publisher_id) } })) });
});

channelsAdminRoutes.post("/admin/channels/reports/:id/resolve", ...moderateGate, async (c) => {
  try {
    const body = z.object({ action: z.enum(["dismiss", "remove_post", "suspend_channel"]), reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose what to do.", 400);
    if (body.data.action !== "dismiss" && !body.data.reason?.trim()) throw new ChannelsError("reason_required", "Give a reason.", 400);
    const id = c.req.param("id") as string;
    const rep = (await db.execute({ sql: "SELECT * FROM post_reports WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
    if (!rep) throw new ChannelsError("not_found", "Report not found.", 404);
    const post = await getPost(String(rep.post_id));
    if (body.data.action === "remove_post" && post) await moderatePost(post.id, "remove", body.data.reason);
    if (body.data.action === "dismiss" && post && post.status === "review") await moderatePost(post.id, "approve");
    if (body.data.action === "suspend_channel" && post && post.publisher_type === "channel") {
      await db.execute({ sql: "UPDATE channels SET status = 'suspended', suspended_reason = ?, updated_at = datetime('now') WHERE id = ?", args: [body.data.reason!.slice(0, 300), post.publisher_id] });
      await moderatePost(post.id, "remove", body.data.reason);
    }
    // Every open report on the same post is settled by one decision.
    await db.execute({ sql: "UPDATE post_reports SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE post_id = ? AND status = 'open'", args: [body.data.action === "dismiss" ? "dismissed" : "actioned", c.get("user").sub, String(rep.post_id)] });
    await logActivity({ actor: c.get("user"), action: `channels.report.${body.data.action}`, entityType: "post", entityId: String(rep.post_id), summary: `Report ${body.data.action.replace("_", " ")}${body.data.reason ? `: ${body.data.reason}` : ""}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

// ----------------------------------------------------------------------- channels

channelsAdminRoutes.get("/admin/channels/list", ...viewGate, async (c) => {
  if (!(await channelsReady())) return c.json({ channels: [] });
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const rows = (await db.execute({
    sql: `SELECT c.*, u.name AS owner_name, u.phone AS owner_phone FROM channels c JOIN users u ON u.id = c.owner_id
          ${q ? "WHERE lower(c.handle) LIKE ? OR lower(c.display_name) LIKE ?" : ""} ORDER BY c.created_at DESC LIMIT 100`,
    args: q ? [`%${q}%`, `%${q}%`] : [],
  })).rows as Row[];
  return c.json({ channels: rows.map((r) => ({ id: String(r.id), handle: String(r.handle), displayName: String(r.display_name), ownerName: String(r.owner_name ?? ""), ownerPhone: String(r.owner_phone ?? ""), status: String(r.status), suspendedReason: (r.suspended_reason as string) ?? null, verified: Number(r.verified_badge) === 1, followers: Number(r.follower_count), createdAt: String(r.created_at) })) });
});

channelsAdminRoutes.post("/admin/channels/:id/status", ...moderateGate, async (c) => {
  try {
    const body = z.object({ status: z.enum(["active", "suspended"]), reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose a status.", 400);
    if (body.data.status === "suspended" && !body.data.reason?.trim()) throw new ChannelsError("reason_required", "Give a reason for suspending a channel.", 400);
    const id = c.req.param("id") as string;
    const res = await db.execute({ sql: "UPDATE channels SET status = ?, suspended_reason = ?, updated_at = datetime('now') WHERE id = ?", args: [body.data.status, body.data.status === "suspended" ? body.data.reason!.slice(0, 300) : null, id] });
    if (!res.rowsAffected) throw new ChannelsError("not_found", "Channel not found.", 404);
    await logActivity({ actor: c.get("user"), action: `channels.channel.${body.data.status}`, entityType: "channel", entityId: id, summary: `${body.data.status === "suspended" ? "Suspended" : "Restored"} a channel${body.data.reason ? `: ${body.data.reason}` : ""}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

channelsAdminRoutes.post("/admin/channels/:id/badge", ...moderateGate, async (c) => {
  const body = z.object({ verified: z.boolean() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const id = c.req.param("id") as string;
  await db.execute({ sql: "UPDATE channels SET verified_badge = ?, updated_at = datetime('now') WHERE id = ?", args: [body.data.verified ? 1 : 0, id] });
  await logActivity({ actor: c.get("user"), action: "channels.channel.badge", entityType: "channel", entityId: id, summary: `${body.data.verified ? "Gave" : "Removed"} the verified badge`, ip: clientIp(c) });
  return c.json({ ok: true });
});

// --------------------------------------------------------------------------- KYC

channelsAdminRoutes.get("/admin/channels/kyc", ...kycGate, async (c) => {
  if (!(await hasTable("creator_kyc"))) return c.json({ checks: [] });
  const status = ["pending", "approved", "rejected"].includes(c.req.query("status") ?? "") ? (c.req.query("status") as string) : "pending";
  const rows = (await db.execute({
    sql: `SELECT k.user_id, k.full_name, k.id_type, k.status, k.submitted_at, k.date_of_birth, u.name AS account_name, u.phone
          FROM creator_kyc k JOIN users u ON u.id = k.user_id WHERE k.status = ? ORDER BY k.submitted_at LIMIT 100`,
    args: [status],
  })).rows as Row[];
  return c.json({ checks: rows.map((r) => ({ userId: String(r.user_id), fullName: String(r.full_name), idType: String(r.id_type), status: String(r.status), submittedAt: String(r.submitted_at), age: ageOn(String(r.date_of_birth ?? "")), accountName: String(r.account_name ?? ""), phone: String(r.phone ?? "") })) });
});

/** The full check, for the person reviewing it (the ID number is shown here and nowhere else). */
channelsAdminRoutes.get("/admin/channels/kyc/:userId", ...kycGate, async (c) => {
  const userId = c.req.param("userId") as string;
  const k = (await db.execute({ sql: "SELECT k.*, u.name AS account_name, u.phone FROM creator_kyc k JOIN users u ON u.id = k.user_id WHERE k.user_id = ?", args: [userId] })).rows[0] as Row | undefined;
  if (!k) return c.json({ error: "not_found" }, 404);
  const accounts = (await db.execute({ sql: "SELECT account_name, network, account_ref FROM creator_payout_accounts WHERE user_id = ? AND status = 'active'", args: [userId] })).rows as Row[];
  await logActivity({ actor: c.get("user"), action: "channels.kyc.view", entityType: "user", entityId: userId, summary: "Opened a verification check", ip: clientIp(c) });
  return c.json({
    userId, fullName: k.full_name, idType: k.id_type, idNumber: k.id_number, dateOfBirth: k.date_of_birth, age: ageOn(String(k.date_of_birth ?? "")),
    status: k.status, reviewNotes: k.review_notes, submittedAt: k.submitted_at, accountName: k.account_name, phone: k.phone,
    hasBack: !!k.id_back_key, hasSelfie: !!k.selfie_key,
    payoutAccounts: accounts.map((a) => ({ name: String(a.account_name), network: (a.network as string) ?? null, number: String(a.account_ref) })),
  });
});

channelsAdminRoutes.get("/admin/channels/kyc/:userId/document/:which", ...kycGate, async (c) => {
  const k = (await db.execute({ sql: "SELECT id_front_key, id_back_key, selfie_key FROM creator_kyc WHERE user_id = ?", args: [c.req.param("userId") as string] })).rows[0] as Row | undefined;
  const key = k ? ({ front: k.id_front_key, back: k.id_back_key, selfie: k.selfie_key } as Record<string, unknown>)[c.req.param("which") as string] : null;
  if (typeof key !== "string") return c.json({ error: "not_found" }, 404);
  const object = await getR2Bucket().get(key);
  if (!object) return c.json({ error: "not_found" }, 404);
  return new Response(object.body, { headers: { ...uploadResponseHeaders(object.httpMetadata?.contentType, "image/jpeg"), "Cache-Control": "private, no-store" } });
});

channelsAdminRoutes.post("/admin/channels/kyc/:userId/review", ...kycGate, async (c) => {
  try {
    const body = z.object({ decision: z.enum(["approve", "reject"]), notes: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose approve or reject.", 400);
    const userId = c.req.param("userId") as string;
    await reviewKyc(userId, body.data.decision, c.get("user").sub, body.data.notes);
    await logActivity({ actor: c.get("user"), action: `channels.kyc.${body.data.decision}`, entityType: "user", entityId: userId, summary: `${body.data.decision === "approve" ? "Approved" : "Rejected"} a creator verification${body.data.notes ? `: ${body.data.notes}` : ""}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

// --------------------------------------------------------------------------- causes

channelsAdminRoutes.get("/admin/channels/causes", ...viewGate, async (c) => {
  if (!(await hasTable("causes"))) return c.json({ causes: [] });
  const status = ["submitted", "live", "ended", "closed", "frozen", "rejected", "draft"].includes(c.req.query("status") ?? "") ? (c.req.query("status") as string) : "submitted";
  const rows = (await db.execute({
    sql: `SELECT c.*, ch.handle, ch.display_name, u.name AS owner_name FROM causes c JOIN channels ch ON ch.id = c.channel_id JOIN users u ON u.id = c.owner_id WHERE c.status = ? ORDER BY c.updated_at DESC LIMIT 100`,
    args: [status],
  })).rows as unknown as Array<CauseRow & Row>;
  const out = [];
  for (const r of rows) out.push({ ...(await serializeCause(r, originOf(c), { owner: true })), ownerName: String(r.owner_name ?? ""), channelHandle: String(r.handle) });
  return c.json({ causes: out });
});

channelsAdminRoutes.post("/admin/channels/causes/:id/review", ...causesGate, async (c) => {
  try {
    const body = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose approve or reject.", 400);
    const id = c.req.param("id") as string;
    const cause = await reviewCause(id, body.data.decision, c.get("user").sub, body.data.reason);
    await logActivity({ actor: c.get("user"), action: `channels.cause.${body.data.decision}`, entityType: "cause", entityId: id, summary: `${body.data.decision === "approve" ? "Approved" : "Rejected"} the cause "${cause.title}"${body.data.reason ? `: ${body.data.reason}` : ""}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

channelsAdminRoutes.post("/admin/channels/causes/:id/freeze", ...causesGate, async (c) => {
  try {
    const body = z.object({ frozen: z.boolean(), reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Choose freeze or unfreeze.", 400);
    if (body.data.frozen && !body.data.reason?.trim()) throw new ChannelsError("reason_required", "Give a reason for freezing a cause.", 400);
    const id = c.req.param("id") as string;
    await freezeCause(id, body.data.frozen);
    await logActivity({ actor: c.get("user"), action: body.data.frozen ? "channels.cause.freeze" : "channels.cause.unfreeze", entityType: "cause", entityId: id, summary: `${body.data.frozen ? "Froze" : "Unfroze"} a cause${body.data.reason ? `: ${body.data.reason}` : ""}`, ip: clientIp(c) });
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

/** Refunds every donor of a cause (fraud, or a cause taken down). */
channelsAdminRoutes.post("/admin/channels/causes/:id/refund-all", ...causesGate, async (c) => {
  try {
    const body = z.object({ reason: z.string().min(3).max(300) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ChannelsError("invalid_body", "Give a reason.", 400);
    const id = c.req.param("id") as string;
    const cause = await getCauseById(id);
    if (!cause) throw new ChannelsError("not_found", "Cause not found.", 404);
    if (Number(cause.released_ugx) > 0) throw new ChannelsError("already_released", "Money has already been released to the creator, so a full refund cannot be made from here.", 409);
    await db.execute({ sql: "UPDATE causes SET status = 'closed', ended_at = COALESCE(ended_at, datetime('now')), updated_at = datetime('now') WHERE id = ? AND status IN ('live', 'frozen', 'ended')", args: [id] });
    const n = await refundCause(id, body.data.reason);
    await logActivity({ actor: c.get("user"), action: "channels.cause.refund_all", entityType: "cause", entityId: id, summary: `Refunded ${n} donations to "${cause.title}": ${body.data.reason}`, ip: clientIp(c) });
    return c.json({ refunded: n });
  } catch (err) {
    return fail(c, err);
  }
});

// ------------------------------------------------------------------- withdrawals

channelsAdminRoutes.get("/admin/channels/withdrawals", ...viewGate, async (c) => {
  if (!(await hasTable("creator_withdrawals"))) return c.json({ withdrawals: [] });
  const rows = (await db.execute({ sql: "SELECT w.*, u.name AS user_name, u.phone FROM creator_withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT 100", args: [] })).rows as Row[];
  return c.json({ withdrawals: rows.map((r) => ({ id: String(r.id), userName: String(r.user_name ?? ""), phone: String(r.phone ?? ""), amountUgx: Number(r.amount_ugx), status: String(r.status), network: (r.network as string) ?? null, environment: String(r.environment), createdAt: String(r.created_at) })) });
});
