import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { notifyUser } from "../lib/webpush.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { getAsset, playbackFor, VideoRequestError, type VideoAssetRow } from "../video/service.js";
import { entitlement } from "./access.js";
import { ChannelsError, requireChannels, sqlTime, parseJson, type Row } from "./common.js";
import { createPost, containsBlockedWord, getPost, publishPost, type PostRow } from "./posts.js";
import { driverOnJob, resolveIdentity } from "./publishers.js";
import type { ChannelsConfig } from "@peebee/shared";

/**
 * Broadcasts and premieres. Both are an "airing": videos that already exist are played to everyone at the same
 * moment, as if live. A broadcast is a programme (one or more videos back to back, like a TV station); a premiere
 * is one video's first showing, and stays up as an ordinary video afterwards. The airing is a live_sessions row, so
 * the live chat, viewer count and helper tools work on it unchanged. No video is re-encoded or streamed from a
 * server: each viewer's player is told which video and how far in to start, and keeps itself in step.
 */

export type EventKind = "broadcast" | "premiere";
export type EventStatus = "scheduled" | "on_air" | "ended";

type ProgramItem = { assetId: string; title: string; durationSeconds: number };

type EventRow = Row & {
  id: string; post_id: string; host_id: string; publisher_type: string; publisher_id: string; title: string | null;
  status: "ready" | "live" | "ended"; kind: EventKind; starts_at: string; max_ends_at: string; program_json: string; loops?: number;
  started_at: string | null; ended_at: string | null; viewer_peak: number;
};

/** The airing columns exist once migration 0144 is applied; until then both features stay off. */
export async function eventsReady(): Promise<boolean> {
  return (await hasTable("live_sessions")) && (await hasColumn("live_sessions", "kind")) && (await hasTable("live_reminders"));
}

async function requireEvents(kind: EventKind): Promise<ChannelsConfig> {
  const cfg = await requireChannels();
  const on = kind === "broadcast" ? cfg.live.broadcastsEnabled : cfg.live.premieresEnabled;
  if (!on || !(await eventsReady())) throw new ChannelsError("airing_unavailable", kind === "broadcast" ? "Broadcasts are not available yet." : "Premieres are not available yet.", 503);
  return cfg;
}

const toTime = (value: string | null | undefined) => (value ? new Date(`${String(value).replace(" ", "T")}Z`).getTime() : 0);

function programOf(row: Pick<EventRow, "program_json">): ProgramItem[] {
  return parseJson<ProgramItem[]>(row.program_json, []);
}

const totalSeconds = (items: ProgramItem[]) => items.reduce((n, i) => n + i.durationSeconds, 0);

const loopsOf = (row: Pick<EventRow, "loops">) => Math.max(1, Number(row.loops ?? 1) || 1);

/** Which video is on, how far into it, and which time round the programme is, at a given moment. */
export function positionAt(items: ProgramItem[], elapsedSeconds: number, loops = 1): { index: number; offsetSeconds: number; loop: number } | null {
  const pass = totalSeconds(items);
  if (pass <= 0 || elapsedSeconds >= pass * loops) return null;
  const loop = Math.floor(Math.max(0, elapsedSeconds) / pass);
  let t = Math.max(0, elapsedSeconds) - loop * pass;
  for (let i = 0; i < items.length; i++) {
    if (t < items[i]!.durationSeconds) return { index: i, offsetSeconds: t, loop: loop + 1 };
    t -= items[i]!.durationSeconds;
  }
  return null;
}

const statusOf = (row: Pick<EventRow, "status">): EventStatus => (row.status === "ready" ? "scheduled" : row.status === "live" ? "on_air" : "ended");

// ------------------------------------------------------------------ the clock

async function findEvent(ref: string): Promise<EventRow | null> {
  if (!(await eventsReady())) return null;
  const res = await db.execute({ sql: "SELECT * FROM live_sessions WHERE (id = ? OR post_id = ?) AND kind != 'camera' ORDER BY created_at DESC LIMIT 1", args: [ref, ref] });
  const row = res.rows[0] as unknown as EventRow | undefined;
  return row ? syncEvent(row) : null;
}

/** Moves an airing along with the clock: it goes on air at its start time and ends when its last video ends. */
export async function syncEvent(row: EventRow): Promise<EventRow> {
  if (row.status === "ended") return row;
  const now = Date.now();
  let current = row;
  if (current.status === "ready" && now >= toTime(current.starts_at)) {
    const res = await db.execute({ sql: "UPDATE live_sessions SET status = 'live', started_at = starts_at WHERE id = ? AND status = 'ready'", args: [row.id] });
    if (res.rowsAffected) {
      await db.execute({ sql: "UPDATE posts SET live_status = 'live', updated_at = datetime('now') WHERE id = ?", args: [row.post_id] });
      void announceOnAir(row).catch((err) => console.error("airing notification failed:", err));
    }
    current = { ...current, status: "live" };
  }
  if (current.status === "live" && now >= toTime(current.max_ends_at)) {
    await db.execute({ sql: "UPDATE live_sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ? AND status != 'ended'", args: [row.id] });
    await db.execute({ sql: "UPDATE posts SET live_status = 'ended', updated_at = datetime('now') WHERE id = ?", args: [row.post_id] });
    await db.execute({ sql: "DELETE FROM live_viewers WHERE session_id = ?", args: [row.id] });
    current = { ...current, status: "ended" };
  }
  return current;
}

/** Tells the people who asked, and (if Admin allows) the channel's followers, that it has started. */
async function announceOnAir(row: EventRow) {
  const cfg = await requireChannels();
  if (!cfg.live.remindersEnabled && !cfg.live.notifyFollowersOnAir) return;
  const ids = new Set<string>();
  if (cfg.live.remindersEnabled) {
    for (const r of (await db.execute({ sql: "SELECT user_id FROM live_reminders WHERE session_id = ? LIMIT 1000", args: [row.id] })).rows as Row[]) ids.add(String(r.user_id));
  }
  if (cfg.live.notifyFollowersOnAir && row.publisher_type === "channel") {
    for (const r of (await db.execute({ sql: "SELECT user_id FROM channel_follows WHERE channel_id = ? LIMIT 500", args: [row.publisher_id] })).rows as Row[]) ids.add(String(r.user_id));
  }
  ids.delete(row.host_id);
  const title = row.title || (row.kind === "premiere" ? "A premiere" : "A broadcast");
  for (const userId of ids) {
    await notifyUser(userId, { title: row.kind === "premiere" ? "Premiere starting now" : "On air now", body: title, url: `/post/${row.post_id}`, tag: `airing-${row.id}` });
  }
}

// ------------------------------------------------------------------ viewing

export type EventView = {
  id: string; kind: EventKind; status: EventStatus; title: string | null; startsAt: string; endsAt: string; durationSeconds: number; items: number; loops: number; reminders: number; remindMe: boolean;
};

function viewOf(row: EventRow, reminders: number, remindMe: boolean): EventView {
  return {
    id: row.id, kind: row.kind, status: statusOf(row), title: row.title ?? null, startsAt: new Date(toTime(row.starts_at)).toISOString(), endsAt: new Date(toTime(row.max_ends_at)).toISOString(),
    durationSeconds: totalSeconds(programOf(row)), items: programOf(row).length, loops: loopsOf(row), reminders, remindMe,
  };
}

/** The airing behind each post, for a page of posts (one query, plus a count of reminders). */
export async function loadEventViews(postIds: string[], viewerId: string | null): Promise<Map<string, EventView>> {
  const out = new Map<string, EventView>();
  if (!postIds.length || !(await eventsReady())) return out;
  const marks = postIds.map(() => "?").join(",");
  const rows = (await db.execute({ sql: `SELECT * FROM live_sessions WHERE post_id IN (${marks}) AND kind != 'camera'`, args: postIds })).rows as unknown as EventRow[];
  if (!rows.length) return out;
  const synced = await Promise.all(rows.map(syncEvent));
  const ids = synced.map((r) => r.id);
  const counts = new Map<string, number>();
  for (const r of (await db.execute({ sql: `SELECT session_id, COUNT(*) AS n FROM live_reminders WHERE session_id IN (${ids.map(() => "?").join(",")}) GROUP BY session_id`, args: ids })).rows as Row[]) counts.set(String(r.session_id), Number(r.n));
  const mine = new Set<string>();
  if (viewerId) {
    for (const r of (await db.execute({ sql: `SELECT session_id FROM live_reminders WHERE user_id = ? AND session_id IN (${ids.map(() => "?").join(",")})`, args: [viewerId, ...ids] })).rows as Row[]) mine.add(String(r.session_id));
  }
  for (const r of synced) out.set(r.post_id, viewOf(r, counts.get(r.id) ?? 0, mine.has(r.id)));
  return out;
}

/** Whether a post is a premiere that has not started, so its video must not be played yet. */
export async function premiereBlocksPlayback(postId: string): Promise<{ startsAt: string } | null> {
  if (!(await eventsReady())) return null;
  const res = await db.execute({ sql: "SELECT * FROM live_sessions WHERE post_id = ? AND kind = 'premiere' LIMIT 1", args: [postId] });
  const row = res.rows[0] as unknown as EventRow | undefined;
  if (!row) return null;
  const synced = await syncEvent(row);
  return synced.status === "ready" ? { startsAt: new Date(toTime(synced.starts_at)).toISOString() } : null;
}

/** What a player needs to join an airing in step with everyone else. */
export async function eventPlay(viewerId: string | null, ref: string) {
  const cfg = await requireChannels();
  const row = await findEvent(ref);
  if (!row) throw new ChannelsError("not_found", "That airing was not found.", 404);
  const post = await getPost(row.post_id);
  if (!post || post.status !== "published") throw new ChannelsError("not_found", "That airing was not found.", 404);
  const ent = await entitlement(post as never, viewerId, cfg);
  if (!ent.allowed) throw new ChannelsError("locked", "This is locked.", 403, { locked: { reason: ent.reason, access: post.access, priceUgx: Number(post.price_ugx) } });

  const items = programOf(row);
  const startsMs = toTime(row.starts_at);
  const now = Date.now();
  if (row.status === "ready") throw new ChannelsError("not_started", "It has not started yet.", 409, { startsAt: new Date(startsMs).toISOString(), serverNow: new Date(now).toISOString() });
  if (row.status === "ended") throw new ChannelsError("ended", "This airing has ended.", 410);
  const loops = loopsOf(row);
  const pos = positionAt(items, (now - startsMs) / 1000, loops);
  if (!pos) throw new ChannelsError("ended", "This airing has ended.", 410);
  const item = items[pos.index]!;
  const asset = await getAsset(item.assetId);
  if (!asset) throw new ChannelsError("not_found", "A video in this airing is no longer available.", 404);
  const remaining = Math.ceil(item.durationSeconds - pos.offsetSeconds);
  let sources;
  try {
    sources = await playbackFor(asset, { cleared: true, ttlSeconds: remaining + 600 });
  } catch (err) {
    if (err instanceof VideoRequestError) throw new ChannelsError(err.code, err.clientMessage, err.status === 503 ? 503 : 502);
    throw err;
  }
  return {
    kind: row.kind, status: "on_air" as const, serverNow: new Date(now).toISOString(), startsAt: new Date(startsMs).toISOString(), endsAt: new Date(toTime(row.max_ends_at)).toISOString(),
    item: { index: pos.index, count: items.length, title: item.title, durationSeconds: item.durationSeconds, offsetSeconds: pos.offsetSeconds, endsInSeconds: remaining, loop: pos.loop, loops },
    // The first video again, when this is the last one and the programme is going round once more.
    upNext: items[pos.index + 1]?.title ?? (pos.loop < loops ? items[0]?.title ?? null : null),
    playback: sources,
  };
}

export async function setReminder(user: { sub: string }, ref: string, on: boolean) {
  const cfg = await requireChannels();
  if (!cfg.live.remindersEnabled) throw new ChannelsError("reminders_off", "Reminders are not available.", 403);
  const row = await findEvent(ref);
  if (!row || row.status === "ended") throw new ChannelsError("not_found", "That airing was not found.", 404);
  if (on) await db.execute({ sql: "INSERT OR IGNORE INTO live_reminders (session_id, user_id) VALUES (?, ?)", args: [row.id, user.sub] });
  else await db.execute({ sql: "DELETE FROM live_reminders WHERE session_id = ? AND user_id = ?", args: [row.id, user.sub] });
  const n = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM live_reminders WHERE session_id = ?", args: [row.id] })).rows[0] as Row).n);
  return { remindMe: on, reminders: n };
}

// ------------------------------------------------------------------ hosting

async function checkWhen(cfg: ChannelsConfig, startsAt: string | null | undefined): Promise<Date> {
  const lead = cfg.live.minLeadMinutes * 60_000;
  const at = startsAt ? new Date(startsAt) : new Date(Date.now() + Math.max(lead, 20_000));
  if (Number.isNaN(at.getTime())) throw new ChannelsError("invalid_time", "That date and time is not valid.", 400);
  if (at.getTime() < Date.now() + lead - 15_000) throw new ChannelsError("too_soon", cfg.live.minLeadMinutes > 0 ? `Choose a time at least ${cfg.live.minLeadMinutes} minutes from now.` : "Choose a time in the future.", 400);
  if (at.getTime() > Date.now() + cfg.live.maxLeadDays * 86_400_000) throw new ChannelsError("too_far", `Choose a time within the next ${cfg.live.maxLeadDays} days.`, 400);
  return at;
}

async function checkPublisher(user: { sub: string; role: string }, cfg: ChannelsConfig, type: string, id: string) {
  const identity = await resolveIdentity(user, type, id);
  if (!identity) throw new ChannelsError("not_your_identity", "You cannot post as that.", 403);
  if (identity.type === "personal" ? !cfg.publishing.personalPosting : !cfg.publishing.publishers.includes(identity.type)) {
    throw new ChannelsError("publisher_unavailable", "Posting is not available for this yet.", 403);
  }
  if (identity.type === "driver" && cfg.publishing.driverBlockWhileOnJob && (await driverOnJob(user.sub))) throw new ChannelsError("on_a_job", "Finish your current trip or delivery first.", 409);
  if (cfg.live.requireVerifiedPublisher && !identity.verified) throw new ChannelsError("not_verified", "Only verified accounts can do this for now.", 403);
  if (cfg.moderation.mode === "before") throw new ChannelsError("needs_review", "This is not available while every post needs approval first.", 403);
  const upcoming = await db.execute({ sql: "SELECT COUNT(*) AS n FROM live_sessions WHERE publisher_type = ? AND publisher_id = ? AND kind != 'camera' AND status != 'ended'", args: [identity.type, identity.id] });
  if (Number((upcoming.rows[0] as Row).n) >= cfg.live.maxUpcomingPerPublisher) throw new ChannelsError("too_many_upcoming", "You have as many upcoming airings as allowed. Wait for one to finish or cancel one.", 429);
  return identity;
}

async function readyAsset(userId: string, assetId: string): Promise<VideoAssetRow> {
  const a = await getAsset(assetId);
  if (!a || a.owner_id !== userId) throw new ChannelsError("video_not_yours", "Choose from your own videos.", 400);
  if (a.status !== "ready") throw new ChannelsError("video_not_ready", "One of the videos is still being prepared. Try again in a moment.", 409);
  if (!a.duration_seconds || Number(a.duration_seconds) <= 0) throw new ChannelsError("video_no_length", "One of the videos has no length yet. Try again in a moment.", 409);
  return a;
}

async function insertEvent(args: { kind: EventKind; user: { sub: string }; postId: string; publisherType: string; publisherId: string; title: string; items: ProgramItem[]; at: Date; loops?: number }) {
  const id = newId("air");
  const loops = args.loops ?? 1;
  const ends = new Date(args.at.getTime() + totalSeconds(args.items) * loops * 1000 + 5_000);
  await db.execute({
    sql: `INSERT INTO live_sessions (id, post_id, host_id, publisher_type, publisher_id, title, provider, status, kind, starts_at, program_json, loops, max_ends_at, environment)
          VALUES (?, ?, ?, ?, ?, ?, 'airing', 'ready', ?, ?, ?, ?, ?, ?)`,
    args: [id, args.postId, args.user.sub, args.publisherType, args.publisherId, args.title || null, args.kind, sqlTime(args.at), JSON.stringify(args.items), loops, sqlTime(ends), await getPlatformEnvironment()],
  });
  await db.execute({ sql: "UPDATE posts SET live_status = 'scheduled', updated_at = datetime('now') WHERE id = ?", args: [args.postId] });
  return (await findEvent(id))!;
}

/** A programme of the host's own ready videos, aired back to back from a start time. */
export async function createBroadcast(user: { sub: string; role: string }, input: { publisherType: string; publisherId: string; title: string; assetIds: string[]; startsAt?: string | null; loops?: number }) {
  const cfg = await requireEvents("broadcast");
  const identity = await checkPublisher(user, cfg, input.publisherType, input.publisherId);
  const title = input.title.trim().slice(0, 140);
  if (!title) throw new ChannelsError("title_required", "Give the broadcast a name.", 400);
  if (containsBlockedWord(title, cfg)) throw new ChannelsError("blocked_words", "Please change the name and try again.", 400);
  const ids = [...new Set(input.assetIds)];
  if (!ids.length) throw new ChannelsError("videos_required", "Choose at least one video.", 400);
  if (ids.length > cfg.live.maxProgramItems) throw new ChannelsError("too_many_videos", `A broadcast can have up to ${cfg.live.maxProgramItems} videos.`, 400);
  const items: ProgramItem[] = [];
  for (const id of ids) {
    const a = await readyAsset(user.sub, id);
    items.push({ assetId: a.id, title: (a.title ?? "").trim() || `Video ${items.length + 1}`, durationSeconds: Math.round(Number(a.duration_seconds)) });
  }
  if (totalSeconds(items) > cfg.live.maxProgramMinutes * 60) throw new ChannelsError("too_long", `A broadcast can run up to ${cfg.live.maxProgramMinutes} minutes.`, 400);
  const loops = Math.floor(Number(input.loops ?? 1));
  if (!Number.isFinite(loops) || loops < 1) throw new ChannelsError("invalid_loops", "Choose how many times it plays, from 1.", 400);
  if (loops > cfg.live.maxLoops) throw new ChannelsError("too_many_loops", cfg.live.maxLoops > 1 ? `A broadcast can play up to ${cfg.live.maxLoops} times.` : "Repeating is not available.", 400);
  if (totalSeconds(items) * loops > cfg.live.maxAirtimeHours * 3600) throw new ChannelsError("too_long_on_air", `One airing can run for up to ${cfg.live.maxAirtimeHours} hours in all, counting every repeat.`, 400);
  const at = await checkWhen(cfg, input.startsAt);

  const post = await createPost(user, { publisherType: identity.type, publisherId: identity.id, type: "live", caption: title, publish: false, toSpotlight: cfg.live.showInSpotlight, toChannel: identity.type === "channel" }, { event: true });
  const first = await getAsset(items[0]!.assetId);
  await db.execute({ sql: "UPDATE posts SET status = 'published', published_at = datetime('now'), cover_url = ? WHERE id = ?", args: [first?.poster_url ?? null, post.id] });
  return viewOf(await insertEvent({ kind: "broadcast", user, postId: post.id, publisherType: identity.type, publisherId: identity.id, title, items, at, loops }), 0, false);
}

/** Turns a video post into a premiere: it goes public with a countdown, and plays for everyone together at the start time. */
export async function createPremiere(user: { sub: string; role: string }, input: { postId: string; startsAt?: string | null }) {
  const cfg = await requireEvents("premiere");
  const post = await getPost(input.postId);
  if (!post || post.author_id !== user.sub) throw new ChannelsError("not_found", "Post not found.", 404);
  if (post.type !== "video" || !post.video_asset_id) throw new ChannelsError("not_a_video", "Only a video can be premiered.", 400);
  if (!["draft", "published"].includes(post.status)) throw new ChannelsError("not_available", "This post cannot be premiered.", 409);
  const existing = await db.execute({ sql: "SELECT 1 FROM live_sessions WHERE post_id = ? AND kind != 'camera'", args: [post.id] });
  if (existing.rows.length) throw new ChannelsError("already_premiere", "This video already has a premiere.", 409);
  const identity = await checkPublisher(user, cfg, post.publisher_type, post.publisher_id);
  const asset = await readyAsset(user.sub, post.video_asset_id);
  const at = await checkWhen(cfg, input.startsAt);
  const title = (post.caption ?? "").trim().slice(0, 140) || (asset.title ?? "").trim() || "Premiere";
  const item: ProgramItem = { assetId: asset.id, title, durationSeconds: Math.round(Number(asset.duration_seconds)) };

  const event = await insertEvent({ kind: "premiere", user, postId: post.id, publisherType: identity.type, publisherId: identity.id, title, items: [item], at });
  // Nobody can play the video before it starts (the playback check below), so it is safe to make it public now.
  if (post.status === "draft") await publishPost(user, post.id);
  return viewOf(event, 0, false);
}

/** Cancels an airing that has not started. A premiere's video simply becomes available as normal; a broadcast is removed. */
export async function cancelEvent(user: { sub: string }, ref: string) {
  await requireChannels();
  const row = await findEvent(ref);
  if (!row || row.host_id !== user.sub) throw new ChannelsError("not_found", "That airing was not found.", 404);
  if (row.status !== "ready") throw new ChannelsError("already_started", "It has already started.", 409);
  await db.execute({ sql: "DELETE FROM live_reminders WHERE session_id = ?", args: [row.id] });
  await db.execute({ sql: "DELETE FROM live_sessions WHERE id = ?", args: [row.id] });
  if (row.kind === "broadcast") await db.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [row.post_id] });
  else await db.execute({ sql: "UPDATE posts SET live_status = NULL, updated_at = datetime('now') WHERE id = ?", args: [row.post_id] });
  return { ok: true as const };
}

export async function rescheduleEvent(user: { sub: string }, ref: string, startsAt: string) {
  const cfg = await requireChannels();
  const row = await findEvent(ref);
  if (!row || row.host_id !== user.sub) throw new ChannelsError("not_found", "That airing was not found.", 404);
  if (row.status !== "ready") throw new ChannelsError("already_started", "It has already started.", 409);
  const at = await checkWhen(cfg, startsAt);
  const ends = new Date(at.getTime() + totalSeconds(programOf(row)) * loopsOf(row) * 1000 + 5_000);
  await db.execute({ sql: "UPDATE live_sessions SET starts_at = ?, max_ends_at = ? WHERE id = ?", args: [sqlTime(at), sqlTime(ends), row.id] });
  return viewOf((await findEvent(row.id))!, 0, false);
}

/** The host's own upcoming and recent airings, for the Studio. */
export async function myEvents(userId: string) {
  if (!(await eventsReady())) return [];
  const rows = (await db.execute({ sql: "SELECT * FROM live_sessions WHERE host_id = ? AND kind != 'camera' ORDER BY starts_at DESC LIMIT 50", args: [userId] })).rows as unknown as EventRow[];
  const synced = await Promise.all(rows.map(syncEvent));
  const out = [];
  for (const r of synced) {
    const n = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM live_reminders WHERE session_id = ?", args: [r.id] })).rows[0] as Row).n);
    out.push({ ...viewOf(r, n, false), postId: r.post_id, peakViewers: Number(r.viewer_peak) });
  }
  return out;
}

/** Cron: puts due airings on air and ends finished ones, so the feed stays right even if nobody opens them. */
export async function sweepEvents(): Promise<number> {
  if (!(await eventsReady())) return 0;
  const due = (await db.execute({ sql: "SELECT * FROM live_sessions WHERE kind != 'camera' AND status != 'ended' AND (starts_at <= datetime('now') OR max_ends_at <= datetime('now')) LIMIT 100", args: [] })).rows as unknown as EventRow[];
  let changed = 0;
  for (const r of due) {
    const next = await syncEvent(r);
    if (next.status !== r.status) changed += 1;
  }
  return changed;
}

export type { PostRow };
