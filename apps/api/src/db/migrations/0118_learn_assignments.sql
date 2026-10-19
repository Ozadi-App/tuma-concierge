-- Migration 0118: Peebee Learn assignments and gradebook.
-- APPLY BY HAND, once. New tables only. Before it is applied, assignments can't be created or submitted and
-- everything else works as before.

-- One row per assignment item (the item itself is an edu_lessons row of type 'assignment').
CREATE TABLE IF NOT EXISTS edu_assignments (
  lesson_id TEXT PRIMARY KEY REFERENCES edu_lessons(id),
  max_points INTEGER NOT NULL DEFAULT 100,
  pass_percent INTEGER NOT NULL DEFAULT 50,
  due_at TEXT,                                   -- ISO time, or none
  allow_resubmit INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS edu_submissions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES edu_lessons(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',      -- submitted, graded
  score INTEGER,
  feedback TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  graded_at TEXT,
  graded_by TEXT,
  UNIQUE (lesson_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_edu_subs_course ON edu_submissions(course_id);
