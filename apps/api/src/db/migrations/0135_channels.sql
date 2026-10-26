-- Migration 0135: Channels (creator spaces), the shared Spotlight post model, memberships and
-- paid posts, creator earnings and verified withdrawals, causes (fundraising), and rewards.
-- Additive only. Needs 0134 (video assets). The code checks for these tables (hasTable) and keeps
-- every Channels feature switched off until they exist, so this can be applied after deploy.
-- Every feature is also an Admin switch (settings.channels_config) and ships off.

-- ---------------------------------------------------------------- channels
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  category TEXT,
  links_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  suspended_reason TEXT,
  verified_badge INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  handle_changed_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (owner_id, environment)
);

CREATE TABLE IF NOT EXISTS channel_follows (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_follows_user ON channel_follows (user_id, created_at);

-- Membership tiers a creator sells.
CREATE TABLE IF NOT EXISTS channel_tiers (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  name TEXT NOT NULL,
  description TEXT,
  price_ugx INTEGER NOT NULL,
  period_days INTEGER NOT NULL DEFAULT 30,
  perks_json TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channel_tiers_channel ON channel_tiers (channel_id, active);

CREATE TABLE IF NOT EXISTS channel_subscriptions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  tier_id TEXT NOT NULL REFERENCES channel_tiers(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  price_ugx INTEGER NOT NULL,
  period_days INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  current_period_end TEXT NOT NULL,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  renewals INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channel_subs_user ON channel_subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_channel_subs_channel ON channel_subscriptions (channel_id, status);
CREATE INDEX IF NOT EXISTS idx_channel_subs_renew ON channel_subscriptions (status, current_period_end);

-- ------------------------------------------------------------------- posts
-- One post model for every publisher. The Spotlight reads across all of them.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  publisher_type TEXT NOT NULL CHECK (publisher_type IN ('channel', 'personal', 'store', 'restaurant', 'learn', 'driver')),
  publisher_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('video', 'image', 'carousel', 'text', 'audio', 'live')),
  caption TEXT,
  tags_json TEXT,
  language TEXT,
  -- Images (carousel/image), an audio address, a live stream address, poll options: kept as JSON.
  media_json TEXT,
  video_asset_id TEXT REFERENCES video_assets(id),
  cover_url TEXT,
  poll_json TEXT,
  -- A store, restaurant or school may tag its own product, dish or course.
  product_ref_type TEXT,
  product_ref_id TEXT,
  access TEXT NOT NULL DEFAULT 'free' CHECK (access IN ('free', 'members', 'pay_per_view')),
  price_ugx INTEGER NOT NULL DEFAULT 0,
  preview_seconds INTEGER NOT NULL DEFAULT 0,
  min_tier_id TEXT REFERENCES channel_tiers(id),
  to_channel INTEGER NOT NULL DEFAULT 1,
  to_spotlight INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'review', 'published', 'removed')),
  scheduled_at TEXT,
  published_at TEXT,
  removed_reason TEXT,
  live_status TEXT CHECK (live_status IN ('scheduled', 'live', 'ended')),
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_publisher ON posts (publisher_type, publisher_id, status, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts (status, to_spotlight, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts (author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_schedule ON posts (status, scheduled_at);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS post_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  reporter_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports (status, created_at);

CREATE TABLE IF NOT EXISTS post_poll_votes (
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  option_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

-- Someone bought access to one pay-per-view post.
CREATE TABLE IF NOT EXISTS post_unlocks (
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  price_ugx INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

-- One row per viewer, post and day. Qualifies for rewards when watched long enough.
CREATE TABLE IF NOT EXISTS post_views (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  viewer_key TEXT NOT NULL,
  day TEXT NOT NULL,
  seconds REAL NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, viewer_key, day)
);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer ON post_views (viewer_key, created_at);

-- A free preview is handed out once per viewer and post in a cooling-off window.
CREATE TABLE IF NOT EXISTS post_previews (
  post_id TEXT NOT NULL REFERENCES posts(id),
  viewer_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, viewer_key)
);

-- ------------------------------------------------- creator money and verification
-- What a creator has earned and can withdraw. A cache of the ledger (kept in step with it).
CREATE TABLE IF NOT EXISTS creator_balances (
  user_id TEXT NOT NULL REFERENCES users(id),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  available_ugx INTEGER NOT NULL DEFAULT 0,
  lifetime_ugx INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, environment)
);

-- One row for each credit to a creator, for their earnings screen.
CREATE TABLE IF NOT EXISTS creator_earnings (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('membership', 'pay_per_view', 'tip', 'gift', 'ad_share', 'reward', 'cause_release')),
  gross_ugx INTEGER NOT NULL,
  fee_ugx INTEGER NOT NULL DEFAULT 0,
  net_ugx INTEGER NOT NULL,
  payer_id TEXT,
  channel_id TEXT,
  post_id TEXT,
  source_id TEXT,
  note TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings (creator_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_earnings_source ON creator_earnings (kind, source_id) WHERE source_id IS NOT NULL;

-- Identity verification, asked for only when someone wants to withdraw.
CREATE TABLE IF NOT EXISTS creator_kyc (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  full_name TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  date_of_birth TEXT,
  id_front_key TEXT NOT NULL,
  id_back_key TEXT,
  selfie_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_creator_kyc_status ON creator_kyc (status, submitted_at);

CREATE TABLE IF NOT EXISTS creator_payout_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'momo' CHECK (type IN ('momo', 'bank')),
  network TEXT,
  account_ref TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_creator_payout_user ON creator_payout_accounts (user_id, status);

CREATE TABLE IF NOT EXISTS creator_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_ugx INTEGER NOT NULL,
  payout_account_id TEXT REFERENCES creator_payout_accounts(id),
  provider TEXT,
  provider_ref TEXT,
  msisdn TEXT,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_user ON creator_withdrawals (user_id, created_at);

-- ------------------------------------------------------------------ causes
CREATE TABLE IF NOT EXISTS causes (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  cover_url TEXT,
  beneficiary TEXT,
  goal_ugx INTEGER NOT NULL,
  raised_ugx INTEGER NOT NULL DEFAULT 0,
  released_ugx INTEGER NOT NULL DEFAULT 0,
  refunded_ugx INTEGER NOT NULL DEFAULT 0,
  donor_count INTEGER NOT NULL DEFAULT 0,
  ends_at TEXT NOT NULL,
  funding_mode TEXT NOT NULL DEFAULT 'keep' CHECK (funding_mode IN ('keep', 'all_or_nothing')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'live', 'rejected', 'ended', 'closed', 'frozen')),
  rejection_reason TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  published_at TEXT,
  ended_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_causes_status ON causes (status, ends_at);
CREATE INDEX IF NOT EXISTS idx_causes_channel ON causes (channel_id, status);

CREATE TABLE IF NOT EXISTS cause_updates (
  id TEXT PRIMARY KEY,
  cause_id TEXT NOT NULL REFERENCES causes(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cause_updates_cause ON cause_updates (cause_id, created_at);

-- A gift to a cause, from a signed-in person or a guest on the public link.
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  cause_id TEXT NOT NULL REFERENCES causes(id),
  -- Lets a guest return to their receipt without an account.
  code TEXT NOT NULL UNIQUE,
  donor_id TEXT REFERENCES users(id),
  donor_name TEXT,
  anonymous INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  amount_ugx INTEGER NOT NULL,
  -- Peebee's cut of the amount, and an optional tip to Peebee on top (neither goes to the creator).
  fee_ugx INTEGER NOT NULL DEFAULT 0,
  tip_ugx INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL CHECK (method IN ('wallet', 'momo')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
  provider TEXT,
  provider_ref TEXT,
  msisdn TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_cause ON donations (cause_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations (donor_id, created_at);

-- ----------------------------------------------------------------- rewards
-- Dated exchange rates, set in Admin. The newest row whose date has passed applies.
CREATE TABLE IF NOT EXISTS reward_rates (
  id TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  ugx_per_1000_points INTEGER NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_rates_from ON reward_rates (effective_from);

-- value_milli is what the points are worth in thousandths of a shilling at the rate in force
-- when they were earned (used when the rate is locked at earning).
CREATE TABLE IF NOT EXISTS creator_points (
  user_id TEXT NOT NULL REFERENCES users(id),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  points INTEGER NOT NULL DEFAULT 0,
  value_milli INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, environment)
);

CREATE TABLE IF NOT EXISTS reward_conversions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL,
  requested_ugx INTEGER NOT NULL,
  paid_ugx INTEGER NOT NULL,
  basis TEXT NOT NULL,
  scale_percent INTEGER NOT NULL DEFAULT 100,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_conversions_creator ON reward_conversions (creator_id, created_at);

-- ------------------------------------------------------- ad revenue share
-- Marks which ad events have been credited to the creator's earnings.
ALTER TABLE ad_events ADD COLUMN settled_at TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_events_unsettled ON ad_events (creator_id, settled_at);
