-- Migration 0135: pluggable video infrastructure and the ad system.
-- Additive only. The code checks for these tables (hasTable) and keeps the
-- features switched off until they exist, so this can be applied after deploy.
--
-- Video: creators either use the platform's video provider or bring their own
-- (Cloudflare Stream, Mux, Cloudinary, Bunny Stream, or a plain HLS/MP4 link).
-- Only the video is brought in — never the provider's own monetisation. Peebee
-- plays every video in its own player and decides the ads (see the ads tables).

-- API credentials, AES-256-GCM encrypted (lib/crypto.ts). owner = 'platform' for the
-- platform's own provider accounts, or the creator's user id for bring-your-own.
CREATE TABLE IF NOT EXISTS video_credentials (
  owner TEXT NOT NULL,
  provider TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner, provider, field)
);

-- One row per video Peebee plays. The provider holds the bytes; this row holds
-- where they are and what is known about them.
CREATE TABLE IF NOT EXISTS video_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  -- 'platform' = the platform's account, 'byo' = the creator's own account, 'link' = a plain URL.
  source TEXT NOT NULL CHECK (source IN ('platform', 'byo', 'link')),
  external_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  poster_url TEXT,
  -- Playback addresses kept for providers that only have public addresses (link, Mux public, Cloudinary).
  hls_url TEXT,
  mp4_url TEXT,
  -- 'public' = anyone with the video id may play it. 'protected' = the API signs a short-lived
  -- address only for someone allowed to watch (needs a provider that can sign).
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'protected')),
  error TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, owner_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_video_assets_owner ON video_assets (owner_id, created_at);

-- Ads. Peebee is the only party that decides ads on a video, whichever provider holds it.
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  advertiser_name TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  -- Pricing: cpm = rate per 1,000 completed impressions, cpv = rate per completed view, cpc = rate per click.
  pricing_model TEXT NOT NULL DEFAULT 'cpm' CHECK (pricing_model IN ('cpm', 'cpv', 'cpc')),
  rate_ugx INTEGER NOT NULL DEFAULT 0,
  budget_ugx INTEGER NOT NULL DEFAULT 0,
  -- Spend is kept in thousandths of a shilling so a per-impression charge never rounds away.
  spent_milli INTEGER NOT NULL DEFAULT 0,
  daily_cap_ugx INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  -- House campaigns are Peebee's own promotions: they earn nothing and fill empty slots.
  is_house INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id),
  kind TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video', 'image')),
  media_url TEXT NOT NULL,
  poster_url TEXT,
  click_url TEXT,
  headline TEXT,
  cta_label TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 15,
  -- Seconds before the viewer may skip. NULL = use the platform setting. 0 = skippable at once.
  skip_after_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paused')),
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign ON ad_creatives (campaign_id, status);

-- One row per ad served (kind 'impression'), then one per later event on it. The unique key makes
-- every beacon safe to retry: the same event on the same served ad is only ever counted once.
CREATE TABLE IF NOT EXISTS ad_events (
  id TEXT PRIMARY KEY,
  serve_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('impression', 'q25', 'q50', 'q75', 'complete', 'click', 'skip')),
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id),
  creative_id TEXT NOT NULL REFERENCES ad_creatives(id),
  video_asset_id TEXT,
  -- The creator whose video the ad ran on; gets creator_share_milli.
  creator_id TEXT,
  viewer_key TEXT,
  slot TEXT,
  -- What the advertiser was charged for this event, and the creator's part of it,
  -- in thousandths of a shilling.
  cost_milli INTEGER NOT NULL DEFAULT 0,
  creator_share_milli INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (serve_id, event)
);
CREATE INDEX IF NOT EXISTS idx_ad_events_campaign ON ad_events (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_creator ON ad_events (creator_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_viewer ON ad_events (viewer_key, created_at);
