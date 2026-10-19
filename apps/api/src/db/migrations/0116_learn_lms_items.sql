-- Migration 0116: Peebee Learn lesson types and stand-alone quizzes/exams.
-- APPLY BY HAND, once, BEFORE deploying the matching code (the old code ignores the new columns, so this is safe first).
-- Lessons become typed items in a class section: text, slides, audio, video, live, quiz, exam. A quiz or exam is
-- its own item (placed wherever the creator likes, usually at the end of a section) instead of hanging off a lesson.

ALTER TABLE edu_lessons ADD COLUMN body TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_lessons ADD COLUMN slides_json TEXT;
ALTER TABLE edu_lessons ADD COLUMN live_json TEXT;

-- Who joined a live lesson, so a creator can see attendance and the learner can be marked as having attended.
CREATE TABLE IF NOT EXISTS edu_live_attendance (
  lesson_id TEXT NOT NULL REFERENCES edu_lessons(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (lesson_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_edu_live_att_course ON edu_live_attendance(course_id);

-- Older content types become the new ones.
UPDATE edu_lessons SET content_type = 'text' WHERE content_type IN ('reading', 'interactive_h5p');
UPDATE edu_lessons SET content_type = 'audio' WHERE content_type = 'audio_story';
UPDATE edu_lessons SET content_type = 'video' WHERE content_type = 'practical_demo';

-- A quiz that was stuck on a lesson becomes its own item at the end of the same section, keeping the learners'
-- scores and attempts. Ids are derived from the lesson id so this is repeatable.
INSERT INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, content_url, position, quiz_json)
SELECT id || '_q', module_id, course_id, 'Quiz: ' || title, 'quiz', 5, '', '', 1000 + position, quiz_json
FROM edu_lessons
WHERE quiz_json IS NOT NULL AND quiz_json != '' AND quiz_json != 'null' AND content_type NOT IN ('quiz', 'exam')
  AND id NOT LIKE '%\_q' ESCAPE '\';

INSERT OR IGNORE INTO edu_lesson_progress (user_id, lesson_id, course_id, best_score_percent, completed_at)
SELECT p.user_id, p.lesson_id || '_q', p.course_id, p.best_score_percent, p.completed_at
FROM edu_lesson_progress p
JOIN edu_lessons q ON q.id = p.lesson_id || '_q'
WHERE p.best_score_percent IS NOT NULL;

UPDATE edu_quiz_attempts SET lesson_id = lesson_id || '_q'
WHERE lesson_id IN (SELECT id FROM edu_lessons WHERE id || '_q' IN (SELECT id FROM edu_lessons WHERE content_type = 'quiz'))
  AND lesson_id NOT LIKE '%\_q' ESCAPE '\';

UPDATE edu_lessons SET quiz_json = NULL
WHERE content_type NOT IN ('quiz', 'exam') AND id || '_q' IN (SELECT id FROM edu_lessons WHERE content_type = 'quiz');
