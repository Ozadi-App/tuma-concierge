-- Migration 0109: Peebee Learn Studio
-- School -> class (or masterclass) -> course -> module -> lesson, owned by the educator who made them.
-- Separate from the unused 0107 education_* tables so nothing already applied is touched.
-- Apply by hand to the live D1 database; the API answers "upgrade pending" until it is applied.

CREATE TABLE IF NOT EXISTS edu_schools (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,                 -- school, academy, college, training_centre, independent_tutor
  streams TEXT NOT NULL,              -- comma list: sprouts,foundations,academy,compass,skills
  tagline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  motto TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',  -- active, suspended (set by staff)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edu_classes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id) ON DELETE CASCADE,
  stream TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'class',     -- class, masterclass
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '',
  framework TEXT NOT NULL DEFAULT 'open_syllabus',
  academic_year TEXT NOT NULL DEFAULT '',
  term TEXT NOT NULL DEFAULT '',
  teacher_name TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 40,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',   -- draft, published
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edu_courses (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES edu_classes(id) ON DELETE CASCADE,
  stream TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  price_ugx INTEGER NOT NULL DEFAULT 0,
  framework TEXT NOT NULL DEFAULT 'open_syllabus',
  outcomes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',   -- draft, published
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edu_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edu_lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES edu_modules(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video',
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  summary TEXT NOT NULL DEFAULT '',
  content_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  quiz_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edu_schools_owner ON edu_schools(owner_id);
CREATE INDEX IF NOT EXISTS idx_edu_classes_school ON edu_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_edu_courses_class ON edu_courses(class_id);
CREATE INDEX IF NOT EXISTS idx_edu_courses_school ON edu_courses(school_id);
CREATE INDEX IF NOT EXISTS idx_edu_modules_course ON edu_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_edu_lessons_module ON edu_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_edu_lessons_course ON edu_lessons(course_id);

-- Parent PIN that unlocks the Sprouts screen timer. Stored as a bcrypt hash, never the PIN itself.
CREATE TABLE IF NOT EXISTS edu_parent_pins (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  pin_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
