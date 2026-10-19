-- Migration 0119: Peebee Learn coupons, bundles and school passes (subscriptions).
-- APPLY BY HAND, once. New tables only. Before it is applied none of these can be created or used and paying for a
-- single course works exactly as before.

CREATE TABLE IF NOT EXISTS edu_coupons (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  code TEXT NOT NULL UNIQUE,
  percent_off INTEGER,                    -- one of percent_off or amount_off_ugx
  amount_off_ugx INTEGER,
  course_id TEXT REFERENCES edu_courses(id),   -- null = any course of the school
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_coupons_school ON edu_coupons(school_id);

CREATE TABLE IF NOT EXISTS edu_coupon_redemptions (
  coupon_id TEXT NOT NULL REFERENCES edu_coupons(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL,
  discount_ugx INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (coupon_id, user_id)
);

CREATE TABLE IF NOT EXISTS edu_bundles (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  price_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft, published
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_bundles_school ON edu_bundles(school_id);

CREATE TABLE IF NOT EXISTS edu_bundle_courses (
  bundle_id TEXT NOT NULL REFERENCES edu_bundles(id),
  course_id TEXT NOT NULL REFERENCES edu_courses(id),
  PRIMARY KEY (bundle_id, course_id)
);

CREATE TABLE IF NOT EXISTS edu_bundle_purchases (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES edu_bundles(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  price_paid_ugx INTEGER NOT NULL,
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bundle_id, user_id)
);

-- A school pass: every published course of the school for a number of days.
CREATE TABLE IF NOT EXISTS edu_plans (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  price_ugx INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edu_plans_school ON edu_plans(school_id);

CREATE TABLE IF NOT EXISTS edu_subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES edu_plans(id),
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  price_paid_ugx INTEGER NOT NULL,
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edu_subs_user ON edu_subscriptions(user_id, school_id);
