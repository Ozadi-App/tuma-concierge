import { Hono, type Context } from "hono";
import { z } from "zod";
import { isSupportApp, supportAppLabel } from "@peebee/shared";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { verifyToken } from "../auth/jwt.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { migrationPending, publicRateLimit } from "../lib/guards.js";
import { newId } from "../lib/ids.js";
import { getOptions } from "../lib/option-settings.js";
import { clientIp, hashKey } from "../lib/ratelimit.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getRawSetting, setRawSetting } from "../lib/settings.js";
import { AI_UNAVAILABLE_REPLY, askAssistant, type ChatTurn } from "./ai.js";

/**
 * Website support chat. A visitor starts in "ai" with the assistant; "Talk to a person" moves the chat to "waiting"
 * (the admin inbox queue), a staff member claims it ("human"), and either side can end it. The browser polls, so it
 * works on plain Workers with no socket server. Everything that defines behaviour is an admin setting (module "support").
 */

export const supportChatRoutes = new Hono();
type Row = Record<string, unknown>;

const NOTES_KEY = "support_chat_ai_notes";
const MAX_TEXT = 1000;
const TABLES = ["support_chats", "support_messages"] as const;

const shaHex = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((b) => b.toString(16).padStart(2, "0")).join("");

const idOf = (c: Context) => c.req.param("id") ?? "";
/** Which apps may show the chat (Admin → Support chat → Settings). A call with no app is the website. */
async function appEnabled(app: string | null): Promise<boolean> {
  const apps = (await getOptions(["support_chat_apps"])).support_chat_apps as string[];
  return apps.includes(app ?? "website");
}

/** Who is signed in, if the request carries a valid token. Never fails the request: a bad or missing token is just an anonymous visitor. */
async function signedInPerson(c: Context): Promise<{ id: string; name: string; role: string } | null> {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyToken(header.slice(7));
    if (payload.practice || payload.guestOrderId) return null;
    const row = (await db.execute({ sql: "SELECT name, role, admin_role FROM users WHERE id = ? AND status = 'active'", args: [payload.sub] })).rows[0] as Row | undefined;
    return row ? { id: payload.sub, name: String(row.name ?? ""), role: row.admin_role ? "staff" : String(row.role) } : null;
  } catch {
    return null;
  }
}

const tablesReady = async () => (await Promise.all(TABLES.map(hasTable))).every(Boolean);

export type PublicMessage = { id: number; from: "user" | "ai" | "agent" | "system"; text: string; at: string; agentName?: string };
const toMessage = (r: Row): PublicMessage => ({
  id: Number(r.id), from: r.sender as PublicMessage["from"], text: String(r.body), at: String(r.created_at),
  ...(r.agent_name ? { agentName: String(r.agent_name) } : {}),
});

async function addMessage(chatId: string, sender: PublicMessage["from"], body: string, agentName?: string | null): Promise<PublicMessage> {
  const res = await db.execute({
    sql: "INSERT INTO support_messages (chat_id, sender, body, agent_name) VALUES (?, ?, ?, ?) RETURNING *",
    args: [chatId, sender, body, agentName ?? null],
  });
  await db.execute({ sql: "UPDATE support_chats SET updated_at = datetime('now') WHERE id = ?", args: [chatId] });
  return toMessage(res.rows[0] as Row);
}

async function messagesAfter(chatId: string, after: number, limit = 100): Promise<PublicMessage[]> {
  const res = await db.execute({ sql: "SELECT * FROM support_messages WHERE chat_id = ? AND id > ? ORDER BY id LIMIT ?", args: [chatId, after, limit] });
  return (res.rows as Row[]).map(toMessage);
}

/** Chats left with a person or in the queue and gone quiet are closed, so the queue never fills with abandoned chats. */
async function closeIdleChats(): Promise<void> {
  const minutes = Number((await getOptions(["support_chat_idle_close_minutes"])).support_chat_idle_close_minutes);
  await db.execute({
    sql: "UPDATE support_chats SET status = 'closed', closed_at = datetime('now') WHERE status IN ('waiting', 'human') AND updated_at < datetime('now', ?)",
    args: [`-${minutes} minutes`],
  });
}

async function queuePosition(chat: Row): Promise<number | null> {
  if (chat.status !== "waiting") return null;
  const res = await db.execute({ sql: "SELECT COUNT(*) AS n FROM support_chats WHERE status = 'waiting' AND handoff_at <= ?", args: [String(chat.handoff_at)] });
  return Number((res.rows[0] as Row).n) || 1;
}

// --------------------------------------------------------------------------------------------- visitor

async function loadOwnChat(c: Context): Promise<{ chat: Row } | { error: Response }> {
  const id = idOf(c);
  const secret = c.req.header("x-chat-secret") ?? "";
  const res = await db.execute({ sql: "SELECT * FROM support_chats WHERE id = ?", args: [id] });
  const chat = res.rows[0] as Row | undefined;
  // One answer for "no such chat" and "wrong secret" so ids cannot be probed.
  if (!chat || !secret || (await shaHex(secret)) !== chat.secret_hash) return { error: c.json({ error: "not_found" }, 404) };
  return { chat };
}

supportChatRoutes.get("/support-chat/config", async (c) => {
  const o = await getOptions(["support_chat_enabled", "support_chat_ai_enabled", "support_chat_human_enabled"]);
  const app = c.req.query("app") ?? null;
  const ready = o.support_chat_enabled === true && (await tablesReady()) && (await appEnabled(app));
  return c.json({ live: ready, aiEnabled: ready && o.support_chat_ai_enabled === true, humanEnabled: ready && o.support_chat_human_enabled === true });
});

supportChatRoutes.post("/support-chat", async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  const o = await getOptions(["support_chat_enabled", "support_chat_ai_enabled", "support_chat_human_enabled"]);
  if (o.support_chat_enabled !== true) return c.json({ error: "disabled", message: "Chat is switched off." }, 503);
  const limited = await publicRateLimit(c, "support_chat_start", null, "rate_limit_support_chat_starts_per_hour", 3600);
  if (limited) return limited;
  const body = z.object({ page: z.string().trim().max(200).optional(), app: z.string().trim().max(30).optional() }).safeParse(await c.req.json().catch(() => ({})));
  const app = body.success && isSupportApp(body.data.app) ? body.data.app : null;
  if (!(await appEnabled(app))) return c.json({ error: "disabled", message: "Chat is switched off here." }, 503);
  const person = await signedInPerson(c);
  const id = newId("sch");
  const secret = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  // A chat with the assistant switched off starts in the queue.
  const toQueue = o.support_chat_ai_enabled !== true && o.support_chat_human_enabled === true;
  await db.execute({
    sql: `INSERT INTO support_chats (id, secret_hash, status, page, ip_hash, handoff_at) VALUES (?, ?, ?, ?, ?, ${toQueue ? "datetime('now')" : "NULL"})`,
    args: [id, await shaHex(secret), toQueue ? "waiting" : "ai", body.success ? (body.data.page ?? null) : null, await hashKey(clientIp(c))],
  });
  // Which app and who: written separately so chats still start before migration 0151 is applied.
  if (await hasColumn("support_chats", "app")) {
    await db.execute({ sql: "UPDATE support_chats SET app = ?, user_id = ?, user_name = ?, user_role = ? WHERE id = ?", args: [app, person?.id ?? null, person?.name ?? null, person?.role ?? null, id] });
  }
  if (toQueue) await addMessage(id, "system", "Connecting you to a support agent…");
  return c.json({ id, secret, status: toQueue ? "waiting" : "ai", aiEnabled: o.support_chat_ai_enabled === true, humanEnabled: o.support_chat_human_enabled === true }, 201);
});

/** The poll: new messages since `after`, plus who the visitor is talking to. */
supportChatRoutes.get("/support-chat/:id", async (c) => {
  const own = await loadOwnChat(c);
  if ("error" in own) return own.error;
  const after = Math.max(0, Number(c.req.query("after")) || 0);
  const chat = own.chat;
  return c.json({
    status: chat.status, agentName: chat.agent_name ?? null, position: await queuePosition(chat),
    messages: await messagesAfter(String(chat.id), after),
  });
});

supportChatRoutes.post("/support-chat/:id/messages", async (c) => {
  const own = await loadOwnChat(c);
  if ("error" in own) return own.error;
  const parsed = z.object({ text: z.string().trim().min(1).max(MAX_TEXT) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: `Messages are 1 to ${MAX_TEXT} characters.` }, 400);
  const limited = await publicRateLimit(c, "support_chat_message", String(own.chat.id), "rate_limit_support_chat_messages_per_minute", 60);
  if (limited) return limited;

  const chatId = String(own.chat.id);
  const o = await getOptions(["support_chat_ai_enabled", "support_chat_max_messages", "support_chat_ai_context_messages"]);
  const sent = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM support_messages WHERE chat_id = ? AND sender = 'user'", args: [chatId] })).rows[0] as Row).n);
  if (sent >= Number(o.support_chat_max_messages)) return c.json({ error: "chat_full", message: "This chat has reached its message limit. Please start a new one." }, 429);

  // Writing to a chat a person has ended starts a fresh turn with the assistant.
  if (own.chat.status === "closed") await db.execute({ sql: "UPDATE support_chats SET status = 'ai', agent_id = NULL, agent_name = NULL, closed_at = NULL WHERE id = ?", args: [chatId] });
  const status = own.chat.status === "closed" ? "ai" : String(own.chat.status);

  const mine = await addMessage(chatId, "user", parsed.data.text);
  const created: PublicMessage[] = [mine];
  if (status === "ai") {
    if (o.support_chat_ai_enabled !== true) {
      created.push(await addMessage(chatId, "ai", "The assistant is switched off right now. Tap \"Talk to a person\" and the support team will help you."));
    } else {
      const recent = await db.execute({
        sql: "SELECT sender, body FROM support_messages WHERE chat_id = ? AND sender IN ('user', 'ai', 'agent') ORDER BY id DESC LIMIT ?",
        args: [chatId, Number(o.support_chat_ai_context_messages)],
      });
      const history: ChatTurn[] = (recent.rows as Row[]).reverse().map((r) => ({ from: r.sender as ChatTurn["from"], text: String(r.body) }));
      let reply = AI_UNAVAILABLE_REPLY;
      try {
        reply = await askAssistant(history, (await getRawSetting(NOTES_KEY)) ?? "", supportAppLabel(own.chat.app as string | null));
      } catch (err) {
        console.error("support chat AI failed", err instanceof Error ? err.message : err);
      }
      created.push(await addMessage(chatId, "ai", reply));
    }
  }
  return c.json({ status, messages: created });
});

supportChatRoutes.post("/support-chat/:id/handoff", async (c) => {
  const own = await loadOwnChat(c);
  if ("error" in own) return own.error;
  const o = await getOptions(["support_chat_human_enabled"]);
  if (o.support_chat_human_enabled !== true) return c.json({ error: "disabled", message: "Talking to a person is not available right now." }, 403);
  const chatId = String(own.chat.id);
  if (own.chat.status === "ai" || own.chat.status === "closed") {
    await db.execute({ sql: "UPDATE support_chats SET status = 'waiting', agent_id = NULL, agent_name = NULL, closed_at = NULL, handoff_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", args: [chatId] });
    await addMessage(chatId, "system", "Connecting you to a support agent…");
  }
  const chat = (await db.execute({ sql: "SELECT * FROM support_chats WHERE id = ?", args: [chatId] })).rows[0] as Row;
  return c.json({ status: chat.status, position: await queuePosition(chat) });
});

/** Visitor leaves the person (or the queue) and goes back to the assistant. */
supportChatRoutes.post("/support-chat/:id/end", async (c) => {
  const own = await loadOwnChat(c);
  if ("error" in own) return own.error;
  const chatId = String(own.chat.id);
  if (own.chat.status === "waiting" || own.chat.status === "human" || own.chat.status === "closed") {
    await db.execute({ sql: "UPDATE support_chats SET status = 'ai', agent_id = NULL, agent_name = NULL, closed_at = NULL, updated_at = datetime('now') WHERE id = ?", args: [chatId] });
    if (own.chat.status === "human") await addMessage(chatId, "system", "The visitor went back to the AI assistant");
  }
  return c.json({ status: "ai" });
});

// --------------------------------------------------------------------------------------------- staff

const gate = [requireAuth, requireRole("admin"), requirePermission("chat.view_support")] as const;
const staffName = (c: Context) => String(c.get("user").name || "Support agent");

supportChatRoutes.get("/admin/support-chats", ...gate, async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  await closeIdleChats();
  const view = c.req.query("view") === "all" ? "all" : "open";
  const identity = await hasColumn("support_chats", "app");
  const res = await db.execute(
    `SELECT c.id, c.status, c.agent_id, c.agent_name, c.page, c.handoff_at, c.created_at, c.updated_at, ${identity ? "c.app, c.user_name, c.user_role," : "NULL AS app, NULL AS user_name, NULL AS user_role,"}
            (SELECT body FROM support_messages m WHERE m.chat_id = c.id AND m.sender != 'system' ORDER BY m.id DESC LIMIT 1) AS last_text,
            (SELECT sender FROM support_messages m WHERE m.chat_id = c.id AND m.sender != 'system' ORDER BY m.id DESC LIMIT 1) AS last_from,
            (SELECT COUNT(*) FROM support_messages m WHERE m.chat_id = c.id AND m.sender = 'user') AS visitor_messages
       FROM support_chats c
      WHERE ${view === "all" ? "1 = 1" : "c.status IN ('waiting', 'human')"}
      ORDER BY CASE c.status WHEN 'waiting' THEN 0 WHEN 'human' THEN 1 ELSE 2 END, COALESCE(c.handoff_at, c.updated_at) ASC
      LIMIT 100`,
  );
  const me = c.get("user").sub;
  return c.json({
    chats: (res.rows as Row[]).map((r) => ({
      id: r.id, status: r.status, agentName: r.agent_name ?? null, mine: r.agent_id === me, page: r.page ?? null,
      app: r.app ?? null, appLabel: supportAppLabel(r.app as string | null), person: r.user_name ? `${r.user_name}${r.user_role ? ` (${r.user_role})` : ""}` : null,
      waitingSince: r.handoff_at ?? null, startedAt: r.created_at, updatedAt: r.updated_at,
      lastText: r.last_text ?? null, lastFrom: r.last_from ?? null, visitorMessages: Number(r.visitor_messages),
    })),
  });
});

supportChatRoutes.get("/admin/support-chats/:id", ...gate, async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  const chat = (await db.execute({ sql: "SELECT * FROM support_chats WHERE id = ?", args: [idOf(c)] })).rows[0] as Row | undefined;
  if (!chat) return c.json({ error: "not_found" }, 404);
  const after = Math.max(0, Number(c.req.query("after")) || 0);
  return c.json({
    id: chat.id, status: chat.status, agentName: chat.agent_name ?? null, mine: chat.agent_id === c.get("user").sub, page: chat.page ?? null,
    appLabel: supportAppLabel((chat.app as string | null) ?? null), person: chat.user_name ? `${chat.user_name}${chat.user_role ? ` (${chat.user_role})` : ""}` : null,
    messages: await messagesAfter(String(chat.id), after, 500),
  });
});

supportChatRoutes.post("/admin/support-chats/:id/claim", ...gate, async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  const user = c.get("user");
  // Only a waiting chat can be claimed, and only once: the first agent to press the button wins.
  const res = await db.execute({
    sql: "UPDATE support_chats SET status = 'human', agent_id = ?, agent_name = ?, updated_at = datetime('now') WHERE id = ? AND status = 'waiting' RETURNING id",
    args: [user.sub, staffName(c), idOf(c)],
  });
  if (res.rows.length === 0) return c.json({ error: "not_waiting", message: "Someone else already took this chat, or the visitor left." }, 409);
  await addMessage(idOf(c), "system", `${staffName(c)} joined the chat`);
  return c.json({ ok: true });
});

supportChatRoutes.post("/admin/support-chats/:id/messages", ...gate, async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  const parsed = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const chat = (await db.execute({ sql: "SELECT * FROM support_chats WHERE id = ?", args: [idOf(c)] })).rows[0] as Row | undefined;
  if (!chat) return c.json({ error: "not_found" }, 404);
  if (chat.status !== "human" || chat.agent_id !== c.get("user").sub) return c.json({ error: "not_yours", message: "Claim this chat before replying." }, 409);
  return c.json({ message: await addMessage(String(chat.id), "agent", parsed.data.text, String(chat.agent_name ?? staffName(c))) }, 201);
});

supportChatRoutes.post("/admin/support-chats/:id/close", ...gate, async (c) => {
  const pending = await migrationPending(c, "0150_support_chat.sql", ...TABLES);
  if (pending) return pending;
  const res = await db.execute({
    sql: "UPDATE support_chats SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('waiting', 'human') RETURNING id",
    args: [idOf(c)],
  });
  if (res.rows.length === 0) return c.json({ error: "not_open" }, 409);
  await addMessage(idOf(c), "system", "The support agent ended the chat");
  return c.json({ ok: true });
});

// What the assistant is told beyond its built-in prompt (policies, opening hours, links). Plain text kept by the team.
const notesGate = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;
supportChatRoutes.get("/admin/support-chat/ai-notes", ...notesGate, async (c) => c.json({ notes: (await getRawSetting(NOTES_KEY)) ?? "", maxLength: 6000 }));
supportChatRoutes.put("/admin/support-chat/ai-notes", ...notesGate, async (c) => {
  const parsed = z.object({ notes: z.string().max(6000) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Notes can be up to 6000 characters." }, 400);
  const before = (await getRawSetting(NOTES_KEY)) ?? "";
  await setRawSetting(NOTES_KEY, parsed.data.notes);
  await logActivity({ actor: c.get("user"), action: "support_chat.ai_notes", entityType: "settings", summary: "Updated what the support chat assistant knows", before: { notes: before }, after: { notes: parsed.data.notes }, ip: clientIp(c) });
  return c.json({ notes: parsed.data.notes });
});
