-- Migration 0149: website support chat — an AI assistant first, with a hand-over to a person from the support team.
-- Additive only (two new tables). Apply by hand to the live D1 database; the deploy does not run it.
-- The code works without it: the website chat keeps its built-in demo replies and the admin inbox shows
-- "migration pending" until it is applied.

CREATE TABLE IF NOT EXISTS support_chats (
  id TEXT PRIMARY KEY,
  -- SHA-256 of the secret the visitor's browser holds; the secret itself is never stored.
  secret_hash TEXT NOT NULL,
  -- ai: talking to the assistant. waiting: asked for a person, in the queue. human: a person has joined. closed: ended.
  status TEXT NOT NULL DEFAULT 'ai' CHECK (status IN ('ai', 'waiting', 'human', 'closed')),
  agent_id TEXT,
  agent_name TEXT,
  page TEXT,
  ip_hash TEXT,
  handoff_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status, updated_at);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'agent', 'system')),
  body TEXT NOT NULL,
  agent_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_id, id);
