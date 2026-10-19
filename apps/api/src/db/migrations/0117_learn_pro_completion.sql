-- Migration 0117: Peebee Learn certificates, badges, drip release and prerequisites.
-- APPLY BY HAND, once. Everything is in new tables, so code that ships before this is applied simply has none of
-- these features (no rules, nothing locked, nothing issued) and keeps working.

-- Per-course rules set by the educator.
CREATE TABLE IF NOT EXISTS edu_course_rules (
  course_id TEXT PRIMARY KEY REFERENCES edu_courses(id),
  sequential INTEGER NOT NULL DEFAULT 0,          -- items must be done in order
  prerequisite_course_id TEXT REFERENCES edu_courses(id),
  certificate_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A section that opens some days after the learner enrolled.
CREATE TABLE IF NOT EXISTS edu_module_drip (
  module_id TEXT PRIMARY KEY REFERENCES edu_modules(id),
  drip_days INTEGER NOT NULL DEFAULT 0
);

-- A certificate is issued once, when a learner finishes a course. The details are copied so it stays as issued.
CREATE TABLE IF NOT EXISTS edu_certificates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  learner_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  school_name TEXT NOT NULL,
  score_percent INTEGER,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_edu_certs_user ON edu_certificates(user_id);

CREATE TABLE IF NOT EXISTS edu_badges (
  user_id TEXT NOT NULL REFERENCES users(id),
  badge TEXT NOT NULL,
  course_id TEXT,
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge)
);
