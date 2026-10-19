-- Migration 0115: Peebee Learn cover images.
-- APPLY BY HAND, once. Adds an optional cover picture to schools and courses. Without a cover the API draws one
-- from the stream and title, so nothing breaks before this is applied or when no picture has been uploaded.

ALTER TABLE edu_schools ADD COLUMN cover_key TEXT;
ALTER TABLE edu_courses ADD COLUMN cover_key TEXT;
