-- Migration 0107: Education Platform Multi-Tier Engine
-- Supports 5 streams (Sprouts, Foundations, Academy, Campus, Skills) and core infrastructure

CREATE TABLE IF NOT EXISTS education_institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subdomain TEXT UNIQUE,
  motto TEXT,
  address TEXT NOT NULL,
  logo_url TEXT,
  badge TEXT,
  supported_streams TEXT NOT NULL, -- JSON array of streams
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_terms (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES education_institutions(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_courses (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES education_institutions(id),
  stream TEXT NOT NULL, -- sprouts, foundations, academy, campus, skills
  code TEXT,
  title TEXT NOT NULL,
  instructor_name TEXT NOT NULL,
  price_ugx INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  thumbnail_url TEXT,
  syllabus_json TEXT, -- JSON module hierarchy
  rating REAL DEFAULT 5.0,
  review_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_submissions (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  reference_id TEXT NOT NULL, -- worksheet_id, exam_id, or skill_task_id
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  payload_json TEXT NOT NULL, -- photos, answers, video URL
  parent_signed INTEGER NOT NULL DEFAULT 0,
  parent_signer_name TEXT,
  parent_signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'submitted', -- pending_parent, submitted, graded, critiqued
  score REAL,
  teacher_remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_critiques (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES education_submissions(id),
  timestamp_seconds INTEGER NOT NULL,
  instructor_name TEXT NOT NULL,
  critique_text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'technique_correction',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_logbooks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  date TEXT NOT NULL,
  practical_hours REAL NOT NULL,
  task_performed TEXT NOT NULL,
  location TEXT NOT NULL,
  supervisor_name TEXT NOT NULL,
  supervisor_signed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_tuition_invoices (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  institution_id TEXT NOT NULL REFERENCES education_institutions(id),
  term_name TEXT NOT NULL,
  total_amount_ugx INTEGER NOT NULL,
  amount_paid_ugx INTEGER NOT NULL DEFAULT 0,
  balance_ugx INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education_guardian_alerts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  channel TEXT NOT NULL, -- sms, whatsapp
  alert_type TEXT NOT NULL, -- attendance, homework_missing, tuition_balance
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edu_inst_slug ON education_institutions(slug);
CREATE INDEX IF NOT EXISTS idx_edu_courses_stream ON education_courses(stream);
CREATE INDEX IF NOT EXISTS idx_edu_submissions_student ON education_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_edu_critiques_sub ON education_critiques(submission_id);
CREATE INDEX IF NOT EXISTS idx_edu_tuition_student ON education_tuition_invoices(student_id);
