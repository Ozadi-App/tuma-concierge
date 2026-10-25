-- Migration 0133: Merchant Tier 3 Dynamic Digital Products Management & Learn LMS Integration
-- Links Tier 3 merchants with Peebee Learn (edu_schools, edu_courses, edu_enrollments) and digital product downloads

-- Digital products (PDF guides, templates, software keys, presets, courses)
CREATE TABLE IF NOT EXISTS store_digital_products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'download', -- download | license_key | course | template | service
  description TEXT DEFAULT '',
  price_ugx INTEGER NOT NULL DEFAULT 0,
  compare_at_price_ugx INTEGER DEFAULT NULL,
  file_url TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  file_size_bytes INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT '',
  max_downloads INTEGER DEFAULT 5, -- 0 for unlimited
  expiry_days INTEGER DEFAULT 30, -- 0 for no expiry
  license_keys_pool TEXT DEFAULT '[]', -- JSON array of keys
  delivery_instructions TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  linked_course_id TEXT DEFAULT NULL, -- references edu_courses(id)
  status TEXT NOT NULL DEFAULT 'published', -- published | draft | archived
  downloads_count INTEGER NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_digital_products_store_id ON store_digital_products(store_id);
CREATE INDEX IF NOT EXISTS idx_store_digital_products_course_id ON store_digital_products(linked_course_id);

-- Customer fulfillment records for digital purchases & course access
CREATE TABLE IF NOT EXISTS store_digital_fulfillments (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  digital_product_id TEXT NOT NULL REFERENCES store_digital_products(id),
  order_id TEXT DEFAULT NULL,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  access_token TEXT NOT NULL UNIQUE,
  license_key_issued TEXT DEFAULT '',
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT DEFAULT NULL,
  edu_enrollment_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_digital_fulfillments_token ON store_digital_fulfillments(access_token);
CREATE INDEX IF NOT EXISTS idx_store_digital_fulfillments_store ON store_digital_fulfillments(store_id);

-- Merchant LMS student enrollments (synchronised with Peebee Learn edu_enrollments)
CREATE TABLE IF NOT EXISTS store_lms_enrollments (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  student_email TEXT DEFAULT '',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_lessons INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  quiz_average_score INTEGER DEFAULT NULL,
  certificate_issued INTEGER NOT NULL DEFAULT 0,
  certificate_url TEXT DEFAULT '',
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  access_status TEXT NOT NULL DEFAULT 'active' -- active | completed | suspended
);

CREATE INDEX IF NOT EXISTS idx_store_lms_enrollments_store ON store_lms_enrollments(store_id);
CREATE INDEX IF NOT EXISTS idx_store_lms_enrollments_course ON store_lms_enrollments(course_id);

-- Link stores to a dedicated Peebee Learn school ID if desired
ALTER TABLE stores ADD COLUMN learn_school_id TEXT DEFAULT NULL;

-- Link courses back to a store if published from merchant store
ALTER TABLE edu_courses ADD COLUMN store_id TEXT DEFAULT NULL;
