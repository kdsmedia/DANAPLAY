// Database schema for DANAPLAY.
// Uses SQLite with WAL. All money stored as INTEGER Rupiah, points as INTEGER.
import { getDb } from './index.js';

const SCHEMA = `
-- ============ Users ============
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,                 -- referral_code of inviter (nullable)
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','BANNED')),
  device_fingerprint TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_fingerprint);

-- ============ Referrals ============
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','QUALIFIED','BONUS_PAID','REJECTED')),
  qualified_at TEXT,
  bonus_paid_at TEXT,
  inviter_bonus INTEGER NOT NULL DEFAULT 0,
  invitee_bonus INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (inviter_id) REFERENCES users(id),
  FOREIGN KEY (invitee_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_id); -- one referral per invitee
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);

-- ============ Campaigns ============
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  package_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  tracking_url TEXT NOT NULL,
  reward_total INTEGER NOT NULL DEFAULT 0,        -- informational total
  required_days INTEGER NOT NULL DEFAULT 1,
  daily_requirement TEXT,                          -- JSON describing expected events
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED','DRAFT')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============ Campaign milestones (step rewards) ============
CREATE TABLE IF NOT EXISTS campaign_milestones (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,          -- logical id e.g. 'INSTALL','DAY5','DAY10','DAY15'
  label TEXT NOT NULL,
  day INTEGER NOT NULL DEFAULT 0,      -- 0 means install milestone
  reward_points INTEGER NOT NULL CHECK (reward_points >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
-- unique milestone per campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_campaign_milestone ON campaign_milestones(campaign_id, milestone_id);

-- ============ Campaign <-> User enrollment (tracking session) ============
CREATE TABLE IF NOT EXISTS campaign_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  tracking_session_id TEXT NOT NULL UNIQUE,
  click_id TEXT,                        -- partner click identifier
  status TEXT NOT NULL DEFAULT 'CLICKED'
    CHECK (status IN ('CLICKED','INSTALLED','ACTIVE','COMPLETED','FAILED','EXPIRED','CANCELLED')),
  active_days INTEGER NOT NULL DEFAULT 0,
  install_at TEXT,
  first_open_at TEXT,
  last_event_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  fail_reason TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
-- prevent duplicate ACTIVE enrollment of same campaign by same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_users_active
  ON campaign_users(user_id, campaign_id)
  WHERE status IN ('CLICKED','INSTALLED','ACTIVE');
CREATE INDEX IF NOT EXISTS idx_campaign_users_status ON campaign_users(status);
CREATE INDEX IF NOT EXISTS idx_campaign_users_tracking ON campaign_users(tracking_session_id);

-- ============ Milestone rewards earned (prevents double reward) ============
CREATE TABLE IF NOT EXISTS campaign_milestone_rewards (
  id TEXT PRIMARY KEY,
  campaign_user_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  point_transaction_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_user_id) REFERENCES campaign_users(id) ON DELETE CASCADE
);
-- THE critical anti-double-reward constraint:
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestone_rewards_unique
  ON campaign_milestone_rewards(campaign_user_id, milestone_id);

-- ============ Campaign events log (raw attribution events) ============
CREATE TABLE IF NOT EXISTS campaign_events (
  id TEXT PRIMARY KEY,
  campaign_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,            -- INSTALL, FIRST_OPEN, DAILY_ACTIVE, APP_OPEN, etc.
  event_id TEXT,                       -- partner event id for idempotency
  event_time TEXT NOT NULL,
  day_index INTEGER,                   -- computed day index (1-based) from first_open
  metadata TEXT,                       -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_user_id) REFERENCES campaign_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_campaign_user ON campaign_events(campaign_user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON campaign_events(event_type);
-- Idempotency: same partner event_id processed once per campaign_user
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_event
  ON campaign_events(campaign_user_id, event_id)
  WHERE event_id IS NOT NULL;

-- Active days dedup: one DAILY_ACTIVE per day per campaign_user
CREATE TABLE IF NOT EXISTS campaign_active_days (
  id TEXT PRIMARY KEY,
  campaign_user_id TEXT NOT NULL,
  day_date TEXT NOT NULL,              -- YYYY-MM-DD in campaign tz
  day_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_user_id) REFERENCES campaign_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_days_unique
  ON campaign_active_days(campaign_user_id, day_date);

-- ============ Point ledger (append-only, atomic) ============
CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EARN','BONUS','REFERRAL','REDEEM','REFUND','ADJUSTMENT','EXPIRED')),
  amount INTEGER NOT NULL,             -- signed: + earn, - redeem
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,                   -- campaign_user_id / withdrawal_id / referral_id
  reference_type TEXT,                 -- campaign / withdrawal / referral / admin
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','REVERSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ptx_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ptx_reference ON point_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_ptx_type ON point_transactions(type);

-- ============ Withdrawals ============
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'DANA',
  destination TEXT NOT NULL,           -- DANA phone number
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  point_transaction_id TEXT,           -- the REDEEM tx that locked points
  refund_transaction_id TEXT,          -- the REFUND tx on failure
  provider_reference TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ============ Admin users ============
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN','SUPER_ADMIN')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- ============ Notifications (in-app) ============
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  is_read INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- ============ Audit log (append-only) ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,            -- admin / system / user
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,                        -- JSON
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- ============ Fraud flags ============
CREATE TABLE IF NOT EXISTS fraud_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category TEXT NOT NULL,              -- MULTI_ACCOUNT, SELF_REFERRAL, DUPLICATE_EVENT, ...
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_status ON fraud_flags(status);

-- ============ Settings (key/value) ============
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ Ads (dynamic ad inventory) ============
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  advertiser TEXT NOT NULL DEFAULT '',
  -- Creative is a placeholder URL/data. Real ad SDK integration replaces this later.
  creative_url TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 30,   -- full ad length
  reward_points INTEGER NOT NULL,                  -- snapshot of reward at view time (defaults to config)
  weight INTEGER NOT NULL DEFAULT 1,               -- selection weight for dynamic serving
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

-- ============ Ad views (per-user ad watch sessions) ============
CREATE TABLE IF NOT EXISTS ad_views (
  id TEXT PRIMARY KEY,
  view_token TEXT NOT NULL UNIQUE,                 -- idempotency key for completion
  user_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','COMPLETED','EXPIRED','FAILED')),
  reward_granted INTEGER NOT NULL DEFAULT 0,        -- 0 until EARN posted; ensures single reward
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  expires_at TEXT NOT NULL,                         -- started_at + ttl
  -- Server-validated watch proof. Client never controls reward; this records server's own
  -- elapsed-time check (started_at -> completed_at >= min watch). skipped flag set if client
  -- tried to complete before minimum watch elapsed.
  skipped INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ad_id) REFERENCES ads(id)
);
CREATE INDEX IF NOT EXISTS idx_ad_views_user ON ad_views(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ad_views_token ON ad_views(view_token);
CREATE INDEX IF NOT EXISTS idx_ad_views_daily ON ad_views(user_id, date(started_at));
`;

const SEED_SETTINGS = `
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('referral_bonus_inviter', '50000'),
  ('referral_bonus_invitee', '50000'),
  ('referral_qualify_first_campaign', 'true'),
  ('campaign_timezone', 'Asia/Jakarta'),
  ('withdrawal_min_points', '200000');
`;

export function runMigrations() {
  const db = getDb();
  db.exec(SCHEMA);
  db.exec(SEED_SETTINGS);
  return true;
}

// Run when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  console.log('✅ Migrations applied to', config.dbPath);
}
