-- Migration 0120: Peebee Learn co-instructors, cohorts, reviews, Q&A and announcements.
-- APPLY BY HAND, once. New tables only. Before it is applied none of these exist and everything else works as before.

-- Teachers who can edit and mark a course alongside the school owner.
CREATE TABLE IF NOT EXISTS edu_course_instructors (
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_edu_instr_user ON edu_course_instructors(user_id);

-- An intake of a course with its own start date and a seat limit.
CREATE TABLE IF NOT EXISTS edu_cohorts (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  enrol_until TEXT,
  capacity INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_cohorts_course ON edu_cohorts(course_id);

CREATE TABLE IF NOT EXISTS edu_cohort_members (
  cohort_id TEXT NOT NULL REFERENCES edu_cohorts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cohort_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_edu_cohort_members_user ON edu_cohort_members(user_id, course_id);

CREATE TABLE IF NOT EXISTS edu_reviews (
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  replied_at TEXT,
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS edu_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  lesson_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_questions_course ON edu_questions(course_id, created_at);

CREATE TABLE IF NOT EXISTS edu_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES edu_questions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  by_teacher INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_answers_question ON edu_answers(question_id);

CREATE TABLE IF NOT EXISTS edu_announcements (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_announce_course ON edu_announcements(course_id, created_at);
