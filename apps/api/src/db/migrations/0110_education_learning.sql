-- Migration 0110: Peebee Learn — lesson media, enrolment, progress, grading and school fees.
-- Apply by hand after 0109. Until it is applied the learner endpoints answer "upgrade pending".

-- One uploaded video or audio file per lesson (the bytes live in R2).
CREATE TABLE IF NOT EXISTS edu_lesson_media (
  lesson_id TEXT PRIMARY KEY REFERENCES edu_lessons(id),
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A learner's place in a course. 'pending' exists only for the instant between claiming the seat and taking payment.
CREATE TABLE IF NOT EXISTS edu_enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',      -- pending, active
  price_paid_ugx INTEGER NOT NULL DEFAULT 0,
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS edu_lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES edu_lessons(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  best_score_percent INTEGER,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS edu_quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES edu_lessons(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  score_percent INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exam answers. Multiple-choice questions are marked by the server; the rest wait for a teacher.
CREATE TABLE IF NOT EXISTS edu_exam_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  exam_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  auto_points INTEGER NOT NULL DEFAULT 0,
  auto_out_of INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  needs_marking INTEGER NOT NULL DEFAULT 0,
  score_percent INTEGER,
  passed INTEGER,
  tab_switch_count INTEGER NOT NULL DEFAULT 0,
  focus_loss_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted',     -- submitted, graded
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, exam_id)
);

-- Fees a school asks a learner to pay. Paid from the learner's Peebee wallet.
CREATE TABLE IF NOT EXISTS edu_fee_invoices (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  amount_ugx INTEGER NOT NULL,
  paid_ugx INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unpaid',        -- unpaid, partial, paid, cancelled
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edu_fee_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES edu_fee_invoices(id),
  payer_id TEXT NOT NULL REFERENCES users(id),
  amount_ugx INTEGER NOT NULL,
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edu_enroll_user ON edu_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_edu_enroll_course ON edu_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_edu_progress_course ON edu_lesson_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_edu_attempts_user ON edu_quiz_attempts(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_edu_invoices_student ON edu_fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_edu_invoices_school ON edu_fee_invoices(school_id);
