-- Migration 0110: Peebee Jobs marketplace ("talent_*"): people find workers and workers find work.
-- APPLY BY HAND. Every table is new, so nothing existing changes. Until this is
-- applied the Jobs API answers "upgrade pending", and even afterwards it stays closed
-- until an admin turns on `talent_enabled`. (The prefix is "talent_" because
-- "work_*" already belongs to the Clean/Fix/Laundry service engine.)

-- ---------------------------------------------------------------------------
-- Categories. Admin edits these. `segment` lets the app show informal-sector
-- and professional work in separate lanes while sharing one search.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES talent_categories(id),
  name TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'both' CHECK (segment IN ('informal', 'professional', 'both')),
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_categories_active ON talent_categories(active, sort_order);

-- ---------------------------------------------------------------------------
-- A person who offers their work. Any Peebee account can have one (riders too,
-- unless admin switches that off). Visible in search only when approved,
-- activated (onboarding fee paid or waived) and switched visible by the owner.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  area TEXT,
  lat REAL,
  lng REAL,
  radius_km INTEGER NOT NULL DEFAULT 10,
  remote INTEGER NOT NULL DEFAULT 0,
  rate_type TEXT NOT NULL DEFAULT 'negotiable' CHECK (rate_type IN ('hour', 'day', 'job', 'negotiable')),
  rate_ugx INTEGER NOT NULL DEFAULT 0 CHECK (rate_ugx >= 0),
  experience_years INTEGER NOT NULL DEFAULT 0,
  portfolio TEXT NOT NULL DEFAULT '[]',
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'offline')),
  visible INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  status_note TEXT,
  id_verified INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  activated_at TEXT,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  moderation_note TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_search ON talent_profiles(status, visible, availability);

CREATE TABLE IF NOT EXISTS talent_profile_categories (
  user_id TEXT NOT NULL REFERENCES talent_profiles(user_id),
  category_id TEXT NOT NULL REFERENCES talent_categories(id),
  PRIMARY KEY (user_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_profile_categories_cat ON talent_profile_categories(category_id);

-- Optional business details for someone who hires. Any customer can post work
-- without one; it is created on their first post.
CREATE TABLE IF NOT EXISTS talent_employers (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  business_name TEXT,
  about TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  activated_at TEXT,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  jobs_posted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- A posted job: a quick gig, a project, or a hiring post (a role to fill).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_jobs (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('gig', 'project', 'hiring')),
  category_id TEXT REFERENCES talent_categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN
    ('pending_review', 'open', 'in_progress', 'filled', 'completed', 'cancelled', 'expired', 'closed', 'rejected')),
  area TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  remote INTEGER NOT NULL DEFAULT 0,
  skills TEXT NOT NULL DEFAULT '[]',
  starts_at TEXT,
  deadline TEXT,
  budget_min_ugx INTEGER NOT NULL DEFAULT 0 CHECK (budget_min_ugx >= 0),
  budget_max_ugx INTEGER NOT NULL DEFAULT 0 CHECK (budget_max_ugx >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'escrow' CHECK (payment_mode IN ('escrow', 'direct', 'none')),
  workers_needed INTEGER NOT NULL DEFAULT 1 CHECK (workers_needed >= 1),
  employment_type TEXT CHECK (employment_type IS NULL OR employment_type IN ('full_time', 'part_time', 'contract', 'casual', 'internship')),
  listing_fee_ugx INTEGER NOT NULL DEFAULT 0,
  boosted_until TEXT,
  moderation_state TEXT NOT NULL DEFAULT 'clear' CHECK (moderation_state IN ('clear', 'review', 'blocked')),
  moderation_note TEXT,
  application_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  recurrence_id TEXT,
  expires_at TEXT,
  published_at TEXT,
  closed_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_jobs_feed ON talent_jobs(status, type, category_id, created_at);
CREATE INDEX IF NOT EXISTS idx_talent_jobs_employer ON talent_jobs(employer_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_jobs_idempotency ON talent_jobs(employer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS talent_applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES talent_jobs(id),
  worker_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL DEFAULT '',
  bid_ugx INTEGER NOT NULL DEFAULT 0 CHECK (bid_ugx >= 0),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'accepted', 'hired', 'rejected', 'withdrawn')),
  contact_unlocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_applications_worker ON talent_applications(worker_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_talent_applications_job ON talent_applications(job_id, status);

-- The agreement between an employer and one worker for a gig or project.
-- Prices and fees are copied here when it is made, so later changes to the
-- fee rules never alter a contract already running.
CREATE TABLE IF NOT EXISTS talent_contracts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES talent_jobs(id),
  application_id TEXT NOT NULL REFERENCES talent_applications(id),
  employer_id TEXT NOT NULL REFERENCES users(id),
  worker_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  price_ugx INTEGER NOT NULL CHECK (price_ugx > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('escrow', 'direct')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled', 'cancelled', 'disputed', 'refunded')),
  -- Escrow only: the employer's money still held (price plus the employer fee, less what was released or refunded).
  held_ugx INTEGER NOT NULL DEFAULT 0,
  -- Total of the fees Peebee charged on this contract, in whole shillings.
  employer_fee_ugx INTEGER NOT NULL DEFAULT 0,
  worker_fee_ugx INTEGER NOT NULL DEFAULT 0,
  -- What Peebee has actually kept so far.
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  paid_to_worker_ugx INTEGER NOT NULL DEFAULT 0,
  refunded_ugx INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  cancel_reason TEXT,
  -- Late-cancellation fee charged to whoever cancelled, and the part of it paid to the other side.
  cancel_fee_ugx INTEGER NOT NULL DEFAULT 0,
  cancel_compensation_ugx INTEGER NOT NULL DEFAULT 0,
  dispute_reason TEXT,
  disputed_by TEXT,
  disputed_at TEXT,
  resolution_note TEXT,
  resolved_by TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (application_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_contracts_worker ON talent_contracts(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_talent_contracts_employer ON talent_contracts(employer_id, status);
CREATE INDEX IF NOT EXISTS idx_talent_contracts_job ON talent_contracts(job_id, status);

-- Every contract is paid out in one or more milestones. A simple gig has one,
-- for the whole price. The fees are split across milestones when they are made.
CREATE TABLE IF NOT EXISTS talent_milestones (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES talent_contracts(id),
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx > 0),
  employer_fee_ugx INTEGER NOT NULL DEFAULT 0,
  worker_fee_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'released')),
  note TEXT,
  submitted_at TEXT,
  confirm_by TEXT,
  released_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_talent_milestones_contract ON talent_milestones(contract_id, position);
CREATE INDEX IF NOT EXISTS idx_talent_milestones_due ON talent_milestones(status, confirm_by);

-- Every movement of escrow money. A row is applied exactly once; ids are fixed
-- per contract and purpose so a retry can never pay twice. (No foreign key on
-- contract_id: the hold is recorded before the contract it pays for exists.)
CREATE TABLE IF NOT EXISTS talent_money (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('hold', 'refund', 'payout')),
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  note TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_talent_money_pending ON talent_money(status, created_at);
CREATE INDEX IF NOT EXISTS idx_talent_money_contract ON talent_money(contract_id);

-- An employer paid (or was given) the right to see a worker's phone number outside a job.
CREATE TABLE IF NOT EXISTS talent_contact_unlocks (
  employer_id TEXT NOT NULL REFERENCES users(id),
  worker_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (employer_id, worker_id)
);

-- An employer asking a particular worker to apply for a job.
CREATE TABLE IF NOT EXISTS talent_invites (
  job_id TEXT NOT NULL REFERENCES talent_jobs(id),
  worker_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_invites_worker ON talent_invites(worker_id, created_at);

-- A job that repeats. "rehire" books the same worker again each period (a new
-- contract, funded when it starts); "repost" puts a fresh open job up each period.
CREATE TABLE IF NOT EXISTS talent_recurrences (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('rehire', 'repost')),
  source_job_id TEXT NOT NULL REFERENCES talent_jobs(id),
  worker_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  price_ugx INTEGER NOT NULL CHECK (price_ugx > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  next_run_at TEXT NOT NULL,
  ends_at TEXT,
  max_runs INTEGER NOT NULL DEFAULT 0,
  runs_done INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_recurrences_due ON talent_recurrences(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_talent_recurrences_employer ON talent_recurrences(employer_id, status);

CREATE TABLE IF NOT EXISTS talent_events (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES talent_jobs(id),
  contract_id TEXT REFERENCES talent_contracts(id),
  actor_id TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('employer', 'worker', 'admin', 'system')),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_events_job ON talent_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_talent_events_contract ON talent_events(contract_id, created_at);

CREATE TABLE IF NOT EXISTS talent_messages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES talent_applications(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_messages_app ON talent_messages(application_id, created_at);

CREATE TABLE IF NOT EXISTS talent_reviews (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES talent_contracts(id),
  from_user TEXT NOT NULL REFERENCES users(id),
  to_user TEXT NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK (direction IN ('employer_to_worker', 'worker_to_employer')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_id, from_user)
);
CREATE INDEX IF NOT EXISTS idx_talent_reviews_to ON talent_reviews(to_user, created_at);

-- Reports from users, plus items the screening put in the review queue.
CREATE TABLE IF NOT EXISTS talent_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('job', 'profile', 'contract', 'user')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'screening')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolution TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_talent_reports_open ON talent_reports(status, created_at);

-- Work that is not allowed. A "block" term stops a post or profile outright;
-- a "review" term lets it through to staff first. Admin edits this list.
CREATE TABLE IF NOT EXISTS talent_prohibited_terms (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'illegal',
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'review')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Monetization. Everything below is data an admin edits: fee rules, plans,
-- which features are Pro, and what was charged. The master "free access" and
-- "free onboarding" switches live in settings and override every rule.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_fee_rules (
  id TEXT PRIMARY KEY,
  -- What is being charged for.
  kind TEXT NOT NULL CHECK (kind IN
    ('worker_onboarding', 'employer_onboarding', 'listing', 'boost', 'application', 'hire_fee', 'contact_unlock', 'employer_commission', 'worker_commission')),
  -- '' = every job type.
  job_type TEXT NOT NULL DEFAULT '' CHECK (job_type IN ('', 'gig', 'project', 'hiring')),
  model TEXT NOT NULL DEFAULT 'free' CHECK (model IN ('free', 'flat', 'percent')),
  flat_ugx INTEGER NOT NULL DEFAULT 0 CHECK (flat_ugx >= 0),
  percent REAL NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 60),
  min_ugx INTEGER NOT NULL DEFAULT 0 CHECK (min_ugx >= 0),
  max_ugx INTEGER NOT NULL DEFAULT 0 CHECK (max_ugx >= 0),
  -- The first N of this charge for each person are free (0 = none).
  free_first_n INTEGER NOT NULL DEFAULT 0 CHECK (free_first_n >= 0),
  active INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, job_type)
);

CREATE TABLE IF NOT EXISTS talent_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL CHECK (audience IN ('worker', 'employer')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_ugx INTEGER NOT NULL DEFAULT 0 CHECK (price_ugx >= 0),
  period_days INTEGER NOT NULL DEFAULT 30 CHECK (period_days >= 1),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- JSON arrays: Pro feature keys this plan unlocks, and fee kinds it waives.
  features TEXT NOT NULL DEFAULT '[]',
  waived_kinds TEXT NOT NULL DEFAULT '[]',
  -- NULL = no change to the commission rule.
  worker_commission_percent REAL CHECK (worker_commission_percent IS NULL OR (worker_commission_percent >= 0 AND worker_commission_percent <= 60)),
  employer_commission_percent REAL CHECK (employer_commission_percent IS NULL OR (employer_commission_percent >= 0 AND employer_commission_percent <= 60)),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plan NULL + status 'trial' = the platform-wide free trial of every Pro feature.
CREATE TABLE IF NOT EXISTS talent_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  audience TEXT NOT NULL CHECK (audience IN ('worker', 'employer')),
  plan_id TEXT REFERENCES talent_plans(id),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  auto_renew INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  price_paid_ugx INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_talent_subscriptions_user ON talent_subscriptions(user_id, audience, status, expires_at);

-- Which features are Pro. pro = 0 means everyone has it.
CREATE TABLE IF NOT EXISTS talent_features (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'both' CHECK (audience IN ('worker', 'employer', 'both')),
  pro INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Every charge, waiver and amount owed, with the reason. Revenue reports sum this.
CREATE TABLE IF NOT EXISTS talent_charges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  job_id TEXT,
  contract_id TEXT,
  amount_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('paid', 'waived', 'due', 'refunded')),
  reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_talent_charges_user ON talent_charges(user_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_talent_charges_created ON talent_charges(created_at);

-- ---------------------------------------------------------------------------
-- Starting data. Fee rules are filled in with sensible numbers but switched off,
-- and settings default to "free access", so nothing is charged until an admin
-- turns charging on.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO talent_fee_rules (id, kind, job_type, model, flat_ugx, percent, min_ugx, max_ugx, free_first_n, active, note) VALUES
  ('tfr_worker_onboarding', 'worker_onboarding', '', 'flat', 5000, 0, 0, 0, 0, 0, 'One-off fee to activate a worker profile'),
  ('tfr_employer_onboarding', 'employer_onboarding', '', 'flat', 0, 0, 0, 0, 0, 0, 'One-off fee for a first-time employer'),
  ('tfr_listing_gig', 'listing', 'gig', 'flat', 0, 0, 0, 0, 3, 0, 'Posting a quick gig'),
  ('tfr_listing_project', 'listing', 'project', 'flat', 2000, 0, 0, 0, 1, 0, 'Posting a project'),
  ('tfr_listing_hiring', 'listing', 'hiring', 'flat', 20000, 0, 0, 0, 0, 0, 'Posting a hiring ad'),
  ('tfr_boost', 'boost', '', 'flat', 5000, 0, 0, 0, 0, 0, 'Featuring a job or profile for the boost period'),
  ('tfr_application', 'application', '', 'flat', 500, 0, 0, 0, 10, 0, 'Applying for a job (first N each month are free)'),
  ('tfr_hire_fee', 'hire_fee', 'hiring', 'percent', 0, 5, 10000, 200000, 0, 0, 'Placement fee when a hiring post is filled (percent of the offered pay)'),
  ('tfr_contact_unlock', 'contact_unlock', '', 'flat', 1000, 0, 0, 0, 0, 0, 'Seeing a worker or applicant phone number before hiring'),
  ('tfr_employer_commission', 'employer_commission', '', 'percent', 0, 3, 0, 0, 0, 0, 'Added on top of what the employer pays for gigs and projects'),
  ('tfr_worker_commission_gig', 'worker_commission', 'gig', 'percent', 0, 10, 0, 0, 0, 0, 'Taken from the worker payout on gigs'),
  ('tfr_worker_commission_project', 'worker_commission', 'project', 'percent', 0, 8, 0, 0, 0, 0, 'Taken from the worker payout on projects');

INSERT OR IGNORE INTO talent_plans (id, code, audience, name, description, price_ugx, period_days, trial_days, features, waived_kinds, worker_commission_percent, employer_commission_percent, sort_order) VALUES
  ('tpl_worker_pro', 'worker_pro', 'worker', 'Worker Pro', 'Unlimited applications, a featured profile and lower commission', 15000, 30, 14, '["unlimited_applications","featured_profile","job_alerts"]', '["application","boost"]', 5, NULL, 10),
  ('tpl_employer_pro', 'employer_pro', 'employer', 'Employer Pro', 'Advanced worker search, contact unlock and free listings', 40000, 30, 14, '["advanced_worker_search","contact_unlock","hiring_pipeline","recurring_jobs"]', '["listing","contact_unlock"]', NULL, 2, 20);

INSERT OR IGNORE INTO talent_features (key, label, description, audience, pro, sort_order) VALUES
  ('advanced_worker_search', 'Advanced worker search', 'Filter workers by rate, rating, verification and availability', 'employer', 0, 10),
  ('contact_unlock', 'Unlock contact details', 'See a worker or applicant phone before hiring', 'employer', 0, 20),
  ('hiring_pipeline', 'Hiring pipeline', 'Shortlist candidates on hiring posts', 'employer', 0, 40),
  ('unlimited_applications', 'Unlimited applications', 'No daily cap on applications', 'worker', 0, 50),
  ('featured_profile', 'Featured profile', 'Show higher in worker search', 'worker', 0, 60),
  ('job_alerts', 'Job alerts', 'Be told first about new matching jobs', 'worker', 0, 70),
  ('recurring_jobs', 'Recurring jobs', 'Repeat a job every day, week or month', 'employer', 0, 35);

INSERT OR IGNORE INTO talent_categories (id, parent_id, name, segment, sort_order) VALUES
  ('tcat_cleaning', NULL, 'Cleaning & housekeeping', 'informal', 10),
  ('tcat_errands', NULL, 'Errands & delivery help', 'informal', 20),
  ('tcat_construction', NULL, 'Construction & building', 'informal', 30),
  ('tcat_repairs', NULL, 'Repairs & technicians', 'informal', 40),
  ('tcat_farm', NULL, 'Farm & garden', 'informal', 50),
  ('tcat_events', NULL, 'Events & hospitality', 'informal', 60),
  ('tcat_beauty', NULL, 'Beauty & tailoring', 'informal', 70),
  ('tcat_driving', NULL, 'Driving & transport', 'informal', 80),
  ('tcat_security', NULL, 'Security & care', 'informal', 90),
  ('tcat_tech', NULL, 'IT, software & data', 'professional', 100),
  ('tcat_design', NULL, 'Design & creative', 'professional', 110),
  ('tcat_writing', NULL, 'Writing & translation', 'professional', 120),
  ('tcat_marketing', NULL, 'Marketing & sales', 'professional', 130),
  ('tcat_finance', NULL, 'Accounting & finance', 'professional', 140),
  ('tcat_legal_admin', NULL, 'Admin, legal & HR', 'professional', 150),
  ('tcat_education', NULL, 'Teaching & training', 'both', 160),
  ('tcat_health', NULL, 'Health & wellness', 'professional', 170),
  ('tcat_engineering', NULL, 'Engineering & architecture', 'professional', 180),
  ('tcat_other', NULL, 'Other lawful work', 'both', 999);

-- Work that is illegal in Uganda or against the Constitution is not allowed on
-- Peebee. "block" stops it at once, "review" holds it for staff. Admin can add
-- and remove terms.
INSERT OR IGNORE INTO talent_prohibited_terms (id, term, category, action) VALUES
  ('tpt_01', 'human trafficking', 'trafficking', 'block'),
  ('tpt_02', 'child labour', 'child_exploitation', 'block'),
  ('tpt_03', 'child labor', 'child_exploitation', 'block'),
  ('tpt_04', 'sex work', 'sexual_services', 'block'),
  ('tpt_05', 'escort', 'sexual_services', 'review'),
  ('tpt_06', 'prostitut', 'sexual_services', 'block'),
  ('tpt_07', 'drug dealer', 'drugs', 'block'),
  ('tpt_08', 'sell drugs', 'drugs', 'block'),
  ('tpt_09', 'cocaine', 'drugs', 'block'),
  ('tpt_10', 'heroin', 'drugs', 'block'),
  ('tpt_11', 'marijuana supply', 'drugs', 'block'),
  ('tpt_12', 'weapon smuggling', 'weapons', 'block'),
  ('tpt_13', 'buy a gun', 'weapons', 'block'),
  ('tpt_14', 'illegal firearm', 'weapons', 'block'),
  ('tpt_15', 'fake certificate', 'forgery', 'block'),
  ('tpt_16', 'forged document', 'forgery', 'block'),
  ('tpt_17', 'fake id', 'forgery', 'block'),
  ('tpt_18', 'counterfeit', 'forgery', 'block'),
  ('tpt_19', 'money laundering', 'financial_crime', 'block'),
  ('tpt_20', 'ponzi', 'fraud', 'block'),
  ('tpt_21', 'pyramid scheme', 'fraud', 'block'),
  ('tpt_22', 'scam', 'fraud', 'review'),
  ('tpt_23', 'hack someone', 'cybercrime', 'block'),
  ('tpt_24', 'hack into', 'cybercrime', 'block'),
  ('tpt_25', 'steal data', 'cybercrime', 'block'),
  ('tpt_26', 'assassin', 'violence', 'block'),
  ('tpt_27', 'hitman', 'violence', 'block'),
  ('tpt_28', 'kill someone', 'violence', 'block'),
  ('tpt_29', 'beat up', 'violence', 'review'),
  ('tpt_30', 'bribe', 'corruption', 'review'),
  ('tpt_31', 'smuggle', 'smuggling', 'review'),
  ('tpt_32', 'ivory', 'wildlife', 'block'),
  ('tpt_33', 'pangolin', 'wildlife', 'block'),
  ('tpt_34', 'organ trade', 'trafficking', 'block'),
  ('tpt_35', 'rig election', 'unconstitutional', 'block'),
  ('tpt_36', 'buy votes', 'unconstitutional', 'block'),
  ('tpt_37', 'ethnic violence', 'unconstitutional', 'block'),
  ('tpt_38', 'overthrow the government', 'unconstitutional', 'block'),
  ('tpt_39', 'ghost worker', 'fraud', 'review'),
  ('tpt_40', 'exam leak', 'fraud', 'review'),
  ('tpt_41', 'write my exam', 'fraud', 'review');
