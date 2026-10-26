-- Migration 0137: course listing and student identity.
-- Apply by hand. Each statement is independent; "duplicate column name" means it was already applied.
-- Needs 0109 (Learn studio) and 0133 (store LMS). Code that uses these checks for them first.

-- Whether a course shows in the Peebee Learn catalogue. A course can be sold by its store without being listed there.
ALTER TABLE edu_courses ADD COLUMN catalog_listed INTEGER NOT NULL DEFAULT 1;

-- A store's student is a real account: the Learn seat belongs to them, not to the merchant who enrolled them.
ALTER TABLE store_lms_enrollments ADD COLUMN user_id TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_lms_enrollments_student ON store_lms_enrollments(course_id, user_id) WHERE user_id IS NOT NULL;
