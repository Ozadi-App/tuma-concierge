import test from "node:test";
import assert from "node:assert/strict";
import { addVideo, setup, type Json } from "./test-harness.js";

async function world(live: Json = { broadcastsEnabled: true, premieresEnabled: true, minLeadMinutes: 0 }) {
  const t = await setup();
  const admin = await t.mkUser("admin1", "admin");
  const host = await t.mkUser("host", "customer", "Amina Nakato");
  const fan = await t.mkUser("fan", "customer", "Joseph Okello Ssebunya");
  const other = await t.mkUser("other");
  await t.configure(admin, { enabled: true, moderation: { reviewFirstPosts: 0 }, live });
  const ch = await t.call("/channels", { token: host, body: { handle: "amina", displayName: "Amina's Kitchen", ageConfirmed: true } });
  assert.equal(ch.status, 201, JSON.stringify(ch.json));
  const channelId = ch.json.channel.id as string;
  const videoA = await addVideo(t.client, "host", { duration: 60 });
  const videoB = await addVideo(t.client, "host", { duration: 90 });
  return { ...t, admin, host, fan, other, channelId, videoA, videoB };
}
type W = Awaited<ReturnType<typeof world>>;

/** Moves an airing's clock so that it started `secondsAgo` seconds ago. */
async function startedAgo(w: W, ref: string, secondsAgo: number) {
  const row = (await w.client.execute({ sql: "SELECT id, program_json FROM live_sessions WHERE id = ? OR post_id = ?", args: [ref, ref] })).rows[0]!;
  const total = (JSON.parse(String(row.program_json)) as Array<{ durationSeconds: number }>).reduce((n, i) => n + i.durationSeconds, 0);
  const at = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
  const start = Date.now() - secondsAgo * 1000;
  await w.client.execute({ sql: "UPDATE live_sessions SET starts_at = ?, max_ends_at = ? WHERE id = ?", args: [at(start), at(start + total * 1000 + 5000), row.id] });
}

async function broadcast(w: W, body: Json = {}) {
  const r = await w.call("/airings/broadcast", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title: "Sunday Cooking Hour", assetIds: [w.videoA, w.videoB], startsAt: new Date(Date.now() + 3600_000).toISOString(), ...body } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.airing as Json;
}

test("airings: off by default, and a missing migration is harmless", async () => {
  const w = await world({});
  const r = await w.call("/airings/broadcast", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title: "x", assetIds: [w.videoA] } });
  assert.equal(r.status, 503, "switched off until an admin turns it on");
  assert.equal((await w.call("/channels/config")).json.live.broadcastsEnabled, false);

  const bare = await setup({ migrate: false });
  const a = await bare.mkUser("admin1", "admin");
  const u = await bare.mkUser("u1");
  await bare.call("/admin/channels/config", { method: "PUT", token: a, body: { enabled: true, live: { broadcastsEnabled: true, premieresEnabled: true } } });
  assert.equal((await bare.call("/airings/broadcast", { token: u, body: { publisherType: "personal", publisherId: "u1", title: "x", assetIds: ["a"] } })).status, 503, "no columns yet: unavailable, not a crash");
  assert.deepEqual((await bare.call("/airings/mine", { token: u })).json.airings, []);
});

test("broadcast: scheduled, on air at the right place in the programme, then ended and gone", async () => {
  const w = await world();
  const air = await broadcast(w);
  assert.equal(air.kind, "broadcast");
  assert.equal(air.status, "scheduled");
  assert.equal(air.items, 2);
  assert.equal(air.durationSeconds, 150);

  // Before the start: a countdown in the feed, no playback, no chat.
  const feed = (await w.call("/spotlight/feed", { token: w.fan })).json.posts as Json[];
  assert.equal(feed.length, 1);
  assert.equal(feed[0]!.event.status, "scheduled");
  assert.equal(feed[0]!.event.kind, "broadcast");
  const early = await w.call(`/airings/${air.id}/play`, { token: w.fan });
  assert.equal(early.status, 409);
  assert.equal(early.json.error, "not_started");
  assert.equal((await w.call(`/live/${air.id}/state`, { token: w.fan })).json.status, "scheduled");
  assert.equal((await w.call(`/live/${feed[0]!.id}/comments`, { token: w.fan, body: { body: "hi" } })).status, 409, "chat opens when it starts");

  // 70 seconds in: the second video, 10 seconds into it. Everyone gets the same answer.
  await startedAgo(w, air.id, 70);
  const a = await w.call(`/airings/${air.id}/play`, { token: w.fan });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.item.index, 1);
  assert.equal(a.json.item.count, 2);
  assert.ok(Math.abs(a.json.item.offsetSeconds - 10) < 2, `offset ${a.json.item.offsetSeconds}`);
  assert.ok(a.json.playback.mp4Url || a.json.playback.hlsUrl, "the video's address comes with it");
  assert.equal(a.json.upNext, null);
  const anon = await w.call(`/airings/${feed[0]!.id}/play`);
  assert.equal(anon.status, 200, "a free broadcast plays for anyone, found by its post too");
  const on = (await w.call("/spotlight/feed", { token: w.fan })).json.posts[0] as Json;
  assert.equal(on.event.status, "on_air");
  assert.equal(on.liveStatus, "live");

  // The chat and the viewer count work while it is on air.
  assert.equal((await w.call(`/live/${on.id}/comments`, { token: w.fan, body: { body: "Smells great!" } })).status, 201);
  const st = await w.call(`/live/${on.id}/state?beat=1`, { token: w.fan });
  assert.equal(st.json.status, "live");
  assert.equal(st.json.comments.length, 1);

  // Past the end: it has ended and leaves the feed.
  await startedAgo(w, air.id, 400);
  assert.equal((await w.call(`/airings/${air.id}/play`, { token: w.fan })).status, 410);
  assert.deepEqual((await w.call("/spotlight/feed", { token: w.fan })).json.posts, []);
});

test("broadcast: rules (own videos, limits, lead time, who can cancel)", async () => {
  const w = await world({ broadcastsEnabled: true, premieresEnabled: true, minLeadMinutes: 5, maxProgramItems: 2, maxLeadDays: 3 });
  const post = (body: Json) => w.call("/airings/broadcast", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title: "Show", assetIds: [w.videoA], ...body } });
  const soon = new Date(Date.now() + 60_000).toISOString();
  assert.equal((await post({ startsAt: soon })).json.error, "too_soon");
  assert.equal((await post({ startsAt: new Date(Date.now() + 10 * 86_400_000).toISOString() })).json.error, "too_far");
  const later = new Date(Date.now() + 3_600_000).toISOString();
  const theirs = await addVideo(w.client, "other", { duration: 30 });
  assert.equal((await post({ startsAt: later, assetIds: [theirs] })).json.error, "video_not_yours");
  assert.equal((await post({ startsAt: later, assetIds: [w.videoA, w.videoB, await addVideo(w.client, "host")] })).json.error, "too_many_videos");
  assert.equal((await post({ startsAt: later, assetIds: [] })).json.error, "invalid_input".replace("invalid_input", "videos_required"));
  assert.equal((await post({ startsAt: later, title: "  " })).json.error, "title_required");
  assert.equal((await w.call("/airings/broadcast", { token: w.fan, body: { publisherType: "channel", publisherId: w.channelId, title: "Hijack", assetIds: [w.videoA], startsAt: later } })).json.error, "not_your_identity");

  const ok = await post({ startsAt: later });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const id = ok.json.airing.id as string;
  assert.equal((await w.call(`/airings/${id}/cancel`, { token: w.fan, method: "POST" })).status, 404, "only the host");
  const moved = await w.call(`/airings/${id}/reschedule`, { token: w.host, body: { startsAt: new Date(Date.now() + 2 * 3_600_000).toISOString() } });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));
  assert.equal((await w.call("/airings/mine", { token: w.host })).json.airings.length, 1);
  assert.equal((await w.call(`/airings/${id}/cancel`, { token: w.host, method: "POST" })).status, 200);
  assert.equal((await w.call("/airings/mine", { token: w.host })).json.airings.length, 0);
  assert.deepEqual((await w.call("/spotlight/feed", { token: w.fan })).json.posts, [], "a cancelled broadcast leaves no post behind");
});

test("premiere: countdown, no peeking, everyone together, then an ordinary video", async () => {
  const w = await world();
  const created = await w.call("/posts", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, type: "video", caption: "My first full recipe", videoAssetId: w.videoA, publish: false } });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const postId = created.json.post.id as string;
  assert.equal((await w.call("/airings/premiere", { token: w.fan, body: { postId } })).status, 404, "only the author");

  const p = await w.call("/airings/premiere", { token: w.host, body: { postId, startsAt: new Date(Date.now() + 3_600_000).toISOString() } });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  assert.equal(p.json.airing.kind, "premiere");
  assert.equal((await w.call("/airings/premiere", { token: w.host, body: { postId } })).json.error, "already_premiere");

  // It is public now (with a countdown) but the video cannot be played yet.
  const feed = (await w.call("/spotlight/feed", { token: w.fan })).json.posts as Json[];
  assert.equal(feed[0]!.id, postId);
  assert.equal(feed[0]!.type, "video");
  assert.equal(feed[0]!.event.status, "scheduled");
  const blocked = await w.call(`/posts/${postId}/playback`, { token: w.fan });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.error, "premiere_not_started");
  assert.equal((await w.call(`/posts/${postId}/playback`, { token: w.host })).status, 200, "the author can check their own video");

  // Reminders.
  const r = await w.call(`/airings/${postId}/remind`, { token: w.fan, body: { on: true } });
  assert.deepEqual(r.json, { remindMe: true, reminders: 1 });
  assert.equal(((await w.call("/spotlight/feed", { token: w.fan })).json.posts[0] as Json).event.remindMe, true);
  assert.equal(((await w.call("/spotlight/feed", { token: w.other })).json.posts[0] as Json).event.remindMe, false);
  assert.equal((await w.call(`/airings/${postId}/remind`, { token: w.fan, body: { on: false } })).json.reminders, 0);

  // On air: everyone is told the same moment; the video plays.
  await startedAgo(w, postId, 20);
  const play = await w.call(`/airings/${postId}/play`, { token: w.fan });
  assert.equal(play.status, 200, JSON.stringify(play.json));
  assert.equal(play.json.kind, "premiere");
  assert.ok(Math.abs(play.json.item.offsetSeconds - 20) < 2);
  assert.equal((await w.call(`/posts/${postId}/playback`, { token: w.fan })).status, 200);

  // Over: it is just a video now, still in the feed.
  await startedAgo(w, postId, 200);
  const after = (await w.call("/spotlight/feed", { token: w.fan })).json.posts as Json[];
  assert.equal(after.length, 1);
  assert.equal(after[0]!.event.status, "ended");
  assert.equal((await w.call(`/posts/${postId}/playback`, { token: w.fan })).status, 200);
  assert.equal((await w.call(`/airings/${postId}/play`, { token: w.fan })).status, 410);
});

test("premiere: a locked video stays locked while it airs", async () => {
  const w = await world();
  const locked = await addVideo(w.client, "host", { duration: 60, protectedVideo: true });
  await w.configure(w.admin, { monetization: { enabled: true } });
  assert.equal((await w.call("/creator/tiers", { token: w.host, body: { name: "Friends", priceUgx: 5000 } })).status, 201);
  const created = await w.call("/posts", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, type: "video", caption: "Members first", videoAssetId: locked, access: "members", publish: false } });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const postId = created.json.post.id as string;
  const pre = await w.call("/airings/premiere", { token: w.host, body: { postId, startsAt: new Date(Date.now() + 3_600_000).toISOString() } });
  assert.equal(pre.status, 201, JSON.stringify(pre.json));
  await startedAgo(w, postId, 10);
  const play = await w.call(`/airings/${postId}/play`, { token: w.fan });
  assert.equal(play.status, 403, "an on-air premiere obeys the post's access rules");
  assert.equal(play.json.error, "locked");
  assert.equal((await w.call(`/airings/${postId}/play`, { token: w.host })).status, 200, "the author is let in");
});

test("airings: the cron puts them on air and ends them, and camera streams are untouched", async () => {
  const w = await world({ enabled: true, broadcastsEnabled: true, premieresEnabled: true, minLeadMinutes: 0 });
  const air = await broadcast(w, { startsAt: new Date(Date.now() + 3_600_000).toISOString() });
  const { sweepLive } = await import("./live.js");
  assert.equal(await sweepLive(), 0, "nothing is due yet");
  await startedAgo(w, air.id, 30);
  assert.equal(await sweepLive(), 1, "it goes on air");
  assert.equal(String((await w.client.execute({ sql: "SELECT live_status FROM posts WHERE id = (SELECT post_id FROM live_sessions WHERE id = ?)", args: [air.id] })).rows[0]!.live_status), "live");
  await startedAgo(w, air.id, 500);
  assert.equal(await sweepLive(), 1, "and ends");

  // A camera stream by the same host is not closed by any of this, and starting one does not end a scheduled airing.
  const air3 = await broadcast(w, { startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString() });
  const cam = await w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title: "Hello" } });
  assert.equal(cam.status, 200, JSON.stringify(cam.json));
  const mine = await w.call("/live/mine", { token: w.host });
  assert.equal(mine.json.live.id, cam.json.live.id, "the camera stream, not the airing");
  const air2 = (await w.client.execute({ sql: "SELECT status FROM live_sessions WHERE id = ?", args: [air3.id] })).rows[0]!;
  assert.equal(String(air2.status), "ready", "the scheduled airing was left alone");
});
