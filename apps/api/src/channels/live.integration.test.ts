import test from "node:test";
import assert from "node:assert/strict";
import { setup, type Json } from "./test-harness.js";

async function world(live: Json = { enabled: true }) {
  const t = await setup();
  const admin = await t.mkUser("admin1", "admin");
  const host = await t.mkUser("host", "customer", "Amina Nakato");
  const fan = await t.mkUser("fan", "customer", "Joseph Okello Ssebunya");
  const helper = await t.mkUser("helper", "customer", "Grace Auma");
  await t.configure(admin, { enabled: true, moderation: { reviewFirstPosts: 0 }, live });
  const ch = await t.call("/channels", { token: host, body: { handle: "amina", displayName: "Amina's Kitchen", ageConfirmed: true } });
  assert.equal(ch.status, 201, JSON.stringify(ch.json));
  return { ...t, admin, host, fan, helper, channelId: ch.json.channel.id as string };
}

async function startAndGo(w: Awaited<ReturnType<typeof world>>, title = "Fresh avocados from Mbale") {
  const s = await w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title } });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  const g = await w.call(`/live/${s.json.live.id}/go`, { token: w.host, method: "POST" });
  assert.equal(g.status, 200, JSON.stringify(g.json));
  return s.json.live.id as string;
}

test("live: off by default, and a missing migration is harmless", async () => {
  const w = await world({});
  const r = await w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId } });
  assert.equal(r.status, 503, "switched off until an admin turns it on");
  assert.equal((await w.call("/channels/config")).json.live.enabled, false);

  const bare = await setup({ migrate: false });
  const a = await bare.mkUser("admin1", "admin");
  const u = await bare.mkUser("u1");
  await bare.call("/admin/channels/config", { method: "PUT", token: a, body: { enabled: true, live: { enabled: true } } });
  assert.equal((await bare.call("/live/start", { token: u, body: { publisherType: "personal", publisherId: "u1" } })).status, 503, "no tables: unavailable, not a crash");
  assert.deepEqual((await bare.call("/live/mine", { token: u })).json.live, null);
});

test("live: start, go live, appear in the Spotlight, end, and disappear", async () => {
  const w = await world();
  const s = await w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId, title: "Fresh avocados from Mbale" } });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal(s.json.live.status, "ready");
  assert.equal(s.json.live.mock, true, "sandbox uses the demo provider");
  assert.ok(s.json.live.publishUrl, "the host gets the address the camera sends to");
  const id = s.json.live.id as string;

  assert.deepEqual((await w.call("/spotlight/feed", { token: w.fan })).json.posts, [], "not public until the camera is connected");
  assert.equal((await w.call(`/live/${id}/state`, { token: w.fan })).status, 404);
  assert.equal((await w.call(`/live/${id}/go`, { token: w.fan, method: "POST" })).status, 404, "only the host can go live");

  await w.call(`/live/${id}/go`, { token: w.host, method: "POST" });
  const feed = (await w.call("/spotlight/feed", { token: w.fan })).json.posts as Json[];
  assert.equal(feed.length, 1);
  assert.equal(feed[0]!.type, "live");
  assert.equal(feed[0]!.liveStatus, "live");
  assert.ok(feed[0]!.media.liveUrl);
  assert.ok(!JSON.stringify(feed).includes("whip"), "the host's private address never reaches viewers");

  const end = await w.call(`/live/${id}/end`, { token: w.host, method: "POST" });
  assert.equal(end.status, 200);
  assert.equal(end.json.status, "ended");
  assert.deepEqual((await w.call("/spotlight/feed", { token: w.fan })).json.posts, [], "an ended stream leaves the feed");
  assert.equal((await w.call(`/live/${id}/state`, { token: w.fan })).json.status, "ended");
});

test("live: viewers are counted, comments flow, and the host sees more than a viewer", async () => {
  const w = await world();
  const id = await startAndGo(w);
  const anon = await w.call(`/live/${id}/state?beat=1`);
  assert.equal(anon.status, 200);
  await w.call(`/live/${id}/state?beat=1`, { token: w.fan });
  const host = await w.call(`/live/${id}/state`, { token: w.host });
  assert.equal(host.json.role, "host");
  assert.equal(host.json.viewers, 2, "an anonymous viewer and a signed-in one");
  assert.equal(host.json.peakViewers, 2);
  const viewerSide = await w.call(`/live/${id}/state`, { token: w.fan });
  assert.equal(viewerSide.json.role, "viewer");
  assert.equal(viewerSide.json.peakViewers, null);

  assert.equal((await w.call(`/live/${id}/comments`, { body: { body: "hello" } })).status, 401, "signed-in people comment");
  const c1 = await w.call(`/live/${id}/comments`, { token: w.fan, body: { body: "Are these ripe?" } });
  assert.equal(c1.status, 201, JSON.stringify(c1.json));
  assert.equal((await w.call(`/live/${id}/comments`, { token: w.fan, body: { body: "again" } })).status, 429, "one person cannot flood the chat");
  await w.call(`/live/${id}/comments`, { token: w.host, body: { body: "Yes, picked this morning!" } });

  const list = await w.call(`/live/${id}/state`, { token: w.fan });
  assert.deepEqual(list.json.comments.map((c: Json) => [c.author, c.byHost]), [["Joseph S.", false], ["Host", true]]);
  const next = await w.call(`/live/${id}/state?after=${list.json.cursor}`, { token: w.fan });
  assert.deepEqual(next.json.comments, [], "polling only returns what is new");
});

test("live: the host hides and pins comments; a helper with the code can too; viewers cannot", async () => {
  const w = await world();
  const id = await startAndGo(w);
  const mk = async (text: string) => (await w.call(`/live/${id}/comments`, { token: w.fan, body: { body: text } })).json.id as number;
  const bad = await mk("rude words");
  await w.client.execute("UPDATE live_comments SET created_at = datetime('now', '-1 minute')"); // let the cooldown pass in the next call
  await w.client.execute("DELETE FROM rate_limits");
  const good = await mk("What time do you deliver?");

  assert.equal((await w.call(`/live/${id}/comments/${bad}/hide`, { token: w.fan, method: "POST" })).status, 403);
  assert.equal((await w.call(`/live/${id}/comments/${bad}/hide`, { token: w.host, method: "POST" })).status, 200);
  const viewer = await w.call(`/live/${id}/state`, { token: w.fan });
  assert.deepEqual(viewer.json.comments.map((c: Json) => c.body), ["What time do you deliver?"], "hidden comments vanish for viewers");
  const hostView = await w.call(`/live/${id}/state`, { token: w.host });
  assert.equal(hostView.json.comments.length, 2, "the host still sees it, marked hidden");
  assert.equal(hostView.json.comments[0].hidden, true);

  await w.call(`/live/${id}/comments/${good}/pin`, { token: w.host, method: "POST" });
  assert.equal((await w.call(`/live/${id}/state`, { token: w.fan })).json.pinned.body, "What time do you deliver?");

  // A helper joins with a code and can moderate, but is not the host.
  assert.equal((await w.call("/live/helper/join", { token: w.helper, body: { code: "123456" } })).status, 404);
  const code = (await w.call(`/live/${id}/helper-code`, { token: w.host, method: "POST" })).json.code as string;
  assert.match(code, /^\d{6}$/);
  assert.equal((await w.call(`/live/${id}/helper-code`, { token: w.fan, method: "POST" })).status, 404, "only the host can make a code");
  const joined = await w.call("/live/helper/join", { token: w.helper, body: { code } });
  assert.equal(joined.status, 200, JSON.stringify(joined.json));
  assert.equal((await w.call(`/live/${id}/state`, { token: w.helper })).json.role, "helper");
  assert.equal((await w.call(`/live/${id}/comments/${good}/unpin`, { token: w.helper, method: "POST" })).status, 200);
  assert.equal((await w.call(`/live/${id}/end`, { token: w.helper, method: "POST" })).status, 404, "a helper cannot end the stream");
  const mine = await w.call("/live/mine", { token: w.helper });
  assert.equal(mine.json.streams.length, 1);
});

test("live: Admin rules hold (followers, drivers, daily limit, time limit, comments off)", async () => {
  const w = await world({ enabled: true, minFollowers: 2, maxPerDay: 1, commentsEnabled: false });
  const start = () => w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId } });
  assert.equal((await start()).json.error, "not_enough_followers");
  await w.call(`/channels/${w.channelId}/follow`, { token: w.fan, method: "POST" });
  await w.call(`/channels/${w.channelId}/follow`, { token: w.helper, method: "POST" });
  const s = await start();
  assert.equal(s.status, 200, JSON.stringify(s.json));
  const id = s.json.live.id as string;
  await w.call(`/live/${id}/go`, { token: w.host, method: "POST" });
  assert.equal((await w.call(`/live/${id}/comments`, { token: w.fan, body: { body: "hi" } })).json.error, "comments_off");
  await w.call(`/live/${id}/end`, { token: w.host, method: "POST" });
  assert.equal((await start()).json.error, "daily_live_limit");
  assert.equal((await w.call("/live/start", { token: w.fan, body: { publisherType: "channel", publisherId: w.channelId } })).json.error, "not_your_identity", "nobody can go live as someone else");
});

test("live: the cron closes streams that ran out of time or lost their host", async () => {
  const w = await world();
  const a = await startAndGo(w);
  const { sweepLive } = await import("./live.js");
  assert.equal(await sweepLive(), 0, "a healthy stream is left alone");
  await w.client.execute({ sql: "UPDATE live_sessions SET host_seen_at = datetime('now', '-10 minutes') WHERE id = ?", args: [a] });
  assert.equal(await sweepLive(), 1);
  assert.equal((await w.call(`/live/${a}/state`)).json.status, "ended");
  assert.deepEqual((await w.call("/spotlight/feed")).json.posts, []);

  // Starting again closes an earlier stream that never ended, and a set-up stream that never went live is cleared.
  const s1 = await w.call("/live/start", { token: w.host, body: { publisherType: "channel", publisherId: w.channelId } });
  await w.client.execute({ sql: "UPDATE live_sessions SET created_at = datetime('now', '-1 hour') WHERE id = ?", args: [s1.json.live.id] });
  assert.equal(await sweepLive(), 1);
  const left = await w.client.execute("SELECT COUNT(*) AS n FROM posts WHERE type = 'live' AND status = 'draft'");
  assert.equal(Number(left.rows[0]!.n), 0, "its draft post goes with it");
});
