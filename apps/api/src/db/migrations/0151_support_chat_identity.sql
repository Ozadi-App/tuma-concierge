-- Migration 0151: which app a support chat came from, and who was signed in.
-- Additive only (new nullable columns). Apply by hand to the live D1 database; the deploy does not run it.
-- The code works without it: chats still work, they just do not record the app or the person, and the inbox
-- shows "Website visitor" until it is applied.
ALTER TABLE support_chats ADD COLUMN app TEXT;
ALTER TABLE support_chats ADD COLUMN user_id TEXT;
ALTER TABLE support_chats ADD COLUMN user_name TEXT;
ALTER TABLE support_chats ADD COLUMN user_role TEXT;
