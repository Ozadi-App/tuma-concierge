-- Migration 0113: Peebee Learn demo content and trial live classes.
-- Marks demo schools so they can be shown, hidden or removed as a set, and lets a live session
-- run itself on a loop (a trial class with no tutor behind it).
-- Apply by hand after 0112. Run it ONCE: SQLite cannot add the same column twice.
-- Until it is applied the catalogue shows everything as before and trial classes are not offered.

ALTER TABLE edu_schools ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE edu_live_sessions ADD COLUMN autopilot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE edu_live_sessions ADD COLUMN autopilot_step INTEGER;

CREATE INDEX IF NOT EXISTS idx_edu_schools_demo ON edu_schools(is_demo);
