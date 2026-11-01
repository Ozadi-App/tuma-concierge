import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { buildSystemPrompt, toContents } from "./ai.js";
import { supportChatRoutes } from "./routes.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      const results = await client.batch(statements.map(({ sql, args }) => ({ sql, args: args as InArgs })), "write");
      return results.map((result) => ({ results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } }));
    },
  } as unknown as D1Database);
}

test("the assistant only sees conversation turns and the team's notes", () => {
  assert.deepEqual(toContents([{ from: "user", text: "a" }, { from: "user", text: "b" }, { from: "ai", text: "c" }, { from: "agent", text: "d" }, { from: "user", text: "e" }]).map((t) => [t.role, t.parts[0].text]), [["user", "a\nb"], ["model", "c\nd"], ["user", "e"]]);
  assert.equal(toContents([{ from: "ai", text: "hi" }]).length, 0, "a model turn cannot open the conversation");
  assert.match(buildSystemPrompt("Office hours: 8 to 5"), /Office hours: 8 to 5/);
});

test("support chat: assistant, hand-over to a person, and back", async (t) => {
  process.env.JWT_SECRET = "local-support-chat-test-secret";
  process.env.GEMINI_API_KEY = "test-gemini-key-padding-padding";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, admin_role) VALUES ('a1', 'a1', 'Ann', 'h', 'admin', 'support_manager')");
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, admin_role) VALUES ('a2', 'a2', 'Ben', 'h', 'admin', 'support_manager')");
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, admin_role) VALUES ('cust', 'cust', 'cust', 'h', 'customer', NULL)");
  const app = new Hono().route("/v1", supportChatRoutes);
  const tokens = { a1: await signToken({ sub: "a1", role: "admin" }), a2: await signToken({ sub: "a2", role: "admin" }), cust: await signToken({ sub: "cust", role: "customer" }) };
  const staff = (who: keyof typeof tokens, method: string, path: string, body?: unknown) =>
    app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async (res: Response) => (await res.json()) as Record<string, any>;

  let aiBody: any = null;
  let aiFails = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    aiBody = JSON.parse(String(init.body));
    return aiFails ? new Response("boom", { status: 500 }) : Response.json({ candidates: [{ content: { parts: [{ text: "Top up from MTN MoMo or Airtel Money." }] } }] });
  }) as typeof fetch;

  try {
    let id = "";
    let secret = "";
    const visitor = (method: string, path: string, body?: unknown, s = secret) =>
      app.request(`/v1/support-chat${path}`, { method, headers: { "X-Chat-Secret": s, "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" }, body: body === undefined ? undefined : JSON.stringify(body) });

    await t.test("config is live once the tables exist", async () => {
      assert.deepEqual(await json(await app.request("/v1/support-chat/config")), { live: true, aiEnabled: true, humanEnabled: true });
    });

    await t.test("a visitor starts a chat and the assistant answers", async () => {
      const res = await app.request("/v1/support-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "/wallet" }) });
      assert.equal(res.status, 201);
      ({ id, secret } = (await json(res)) as { id: string; secret: string });
      const sent = await json(await visitor("POST", `/${id}/messages`, { text: "How do I top up?" }));
      assert.deepEqual(sent.messages.map((m: any) => m.from), ["user", "ai"]);
      assert.match(sent.messages[1].text, /MTN MoMo/);
      assert.equal(aiBody.contents.at(-1).parts[0].text, "How do I top up?");
      assert.ok(aiBody.systemInstruction.parts[0].text.includes("Peebee"));
      assert.equal(JSON.stringify(aiBody).includes(secret), false);
    });

    await t.test("another browser cannot read or write the chat", async () => {
      assert.equal((await visitor("GET", `/${id}`, undefined, "wrong")).status, 404);
      assert.equal((await visitor("GET", `/${id}`, undefined, "")).status, 404);
      assert.equal((await visitor("POST", `/${id}/messages`, { text: "hi" }, "wrong")).status, 404);
    });

    await t.test("if the AI fails the visitor is pointed to a person, not shown an error", async () => {
      aiFails = true;
      const sent = await json(await visitor("POST", `/${id}/messages`, { text: "hello?" }));
      aiFails = false;
      assert.match(sent.messages[1].text, /Talk to a person/);
    });

    await t.test("empty and over-long messages are refused", async () => {
      assert.equal((await visitor("POST", `/${id}/messages`, { text: "   " })).status, 400);
      assert.equal((await visitor("POST", `/${id}/messages`, { text: "x".repeat(1001) })).status, 400);
    });

    await t.test("customers cannot reach the inbox; support staff can", async () => {
      assert.equal((await staff("cust", "GET", "/admin/support-chats")).status, 403);
      assert.equal((await staff("a1", "GET", "/admin/support-chats")).status, 200);
      assert.equal((await staff("cust", "PUT", "/admin/support-chat/ai-notes", { notes: "x" })).status, 403);
    });

    await t.test("asking for a person queues the chat and the AI stops answering", async () => {
      const h = await json(await visitor("POST", `/${id}/handoff`));
      assert.deepEqual([h.status, h.position], ["waiting", 1]);
      aiBody = null;
      const sent = await json(await visitor("POST", `/${id}/messages`, { text: "Are you there?" }));
      assert.deepEqual(sent.messages.map((m: any) => m.from), ["user"]);
      assert.equal(aiBody, null, "no AI call while a person is expected");
      const inbox = await json(await staff("a1", "GET", "/admin/support-chats"));
      assert.equal(inbox.chats.length, 1);
      assert.deepEqual([inbox.chats[0].status, inbox.chats[0].lastText, inbox.chats[0].page], ["waiting", "Are you there?", "/wallet"]);
    });

    await t.test("only one agent can claim, and only the claimer replies", async () => {
      assert.equal((await staff("a1", "POST", `/admin/support-chats/${id}/claim`)).status, 200);
      assert.equal((await staff("a2", "POST", `/admin/support-chats/${id}/claim`)).status, 409);
      assert.equal((await staff("a2", "POST", `/admin/support-chats/${id}/messages`, { text: "hi" })).status, 409);
      assert.equal((await staff("a1", "POST", `/admin/support-chats/${id}/messages`, { text: "Hello, this is Ann." })).status, 201);
    });

    await t.test("the visitor polls and sees the agent, and only new messages", async () => {
      const first = await json(await visitor("GET", `/${id}?after=0`));
      assert.deepEqual([first.status, first.agentName], ["human", "Ann"]);
      assert.deepEqual(first.messages.at(-1).from, "agent");
      const last = first.messages.at(-1).id;
      assert.equal((await json(await visitor("GET", `/${id}?after=${last}`))).messages.length, 0);
    });

    await t.test("ending the person chat returns the visitor to the assistant", async () => {
      assert.equal((await staff("a1", "POST", `/admin/support-chats/${id}/close`)).status, 200);
      assert.equal((await json(await visitor("GET", `/${id}`))).status, "closed");
      const sent = await json(await visitor("POST", `/${id}/messages`, { text: "One more question" }));
      assert.deepEqual([sent.status, sent.messages.map((m: any) => m.from)], ["ai", ["user", "ai"]]);
    });

    await t.test("an abandoned queue entry is closed after the idle time", async () => {
      await visitor("POST", `/${id}/handoff`);
      await client.execute({ sql: "UPDATE support_chats SET updated_at = datetime('now', '-3 hours') WHERE id = ?", args: [id] });
      const inbox = await json(await staff("a1", "GET", "/admin/support-chats"));
      assert.equal(inbox.chats.length, 0);
    });

    await t.test("admin switches are honoured", async () => {
      await client.execute("INSERT INTO settings (key, value) VALUES ('support_chat_human_enabled', '0')");
      const { invalidateSettingsCache } = await import("../lib/settings.js");
      invalidateSettingsCache();
      assert.equal((await visitor("POST", `/${id}/handoff`)).status, 403);
      await client.execute("DELETE FROM settings WHERE key = 'support_chat_human_enabled'");
      invalidateSettingsCache();
    });

    await t.test("a signed-in app user is recorded, and the AI is told which app they are in", async () => {
      const res = await app.request("/v1/support-chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.cust}`, "cf-connecting-ip": "5.6.7.8" }, body: JSON.stringify({ app: "rider", page: "/help" }) });
      assert.equal(res.status, 201);
      const made = await json(res);
      await visitor("POST", `/${made.id}/messages`, { text: "My job is stuck" }, made.secret);
      assert.match(aiBody.systemInstruction.parts[0].text, /Rider app/);
      await visitor("POST", `/${made.id}/handoff`, undefined, made.secret);
      const inbox = await json(await staff("a1", "GET", "/admin/support-chats"));
      const row = inbox.chats.find((c: any) => c.id === made.id);
      assert.deepEqual([row.appLabel, row.person], ["Rider app", "cust (customer)"]);
      await staff("a1", "POST", `/admin/support-chats/${made.id}/close`);
    });

    await t.test("a bad token is just an anonymous visitor, and an unknown app is the website", async () => {
      const res = await app.request("/v1/support-chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer nonsense", "cf-connecting-ip": "9.9.9.9" }, body: JSON.stringify({ app: "not-an-app" }) });
      assert.equal(res.status, 201);
      const made = await json(res);
      await visitor("POST", `/${made.id}/handoff`, undefined, made.secret);
      const row = (await json(await staff("a1", "GET", "/admin/support-chats"))).chats.find((c: any) => c.id === made.id);
      assert.deepEqual([row.app, row.person], [null, null]);
    });

    await t.test("admin can switch the chat off for one app", async () => {
      const { invalidateSettingsCache } = await import("../lib/settings.js");
      await client.execute({ sql: "INSERT INTO settings (key, value) VALUES ('support_chat_apps', ?)", args: [JSON.stringify(["website", "customer"])] });
      invalidateSettingsCache();
      assert.equal((await json(await app.request("/v1/support-chat/config?app=rider"))).live, false);
      assert.equal((await json(await app.request("/v1/support-chat/config?app=customer"))).live, true);
      assert.equal((await json(await app.request("/v1/support-chat/config"))).live, true, "the website");
      const res = await app.request("/v1/support-chat", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "4.4.4.4" }, body: JSON.stringify({ app: "rider" }) });
      assert.equal(res.status, 503);
      await client.execute("DELETE FROM settings WHERE key = 'support_chat_apps'");
      invalidateSettingsCache();
    });

    await t.test("AI notes are saved for the assistant and logged", async () => {
      assert.equal((await staff("a1", "PUT", "/admin/support-chat/ai-notes", { notes: "Support hours: 8am to 8pm." })).status, 403, "support managers cannot change settings");
      await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'a2'");
      assert.equal((await staff("a2", "PUT", "/admin/support-chat/ai-notes", { notes: "Support hours: 8am to 8pm." })).status, 200);
      await visitor("POST", `/${id}/messages`, { text: "When are you open?" });
      assert.match(aiBody.systemInstruction.parts[0].text, /8am to 8pm/);
      const log = await client.execute("SELECT action FROM admin_activity_log WHERE action = 'support_chat.ai_notes'");
      assert.equal(log.rows.length, 1);
    });
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
