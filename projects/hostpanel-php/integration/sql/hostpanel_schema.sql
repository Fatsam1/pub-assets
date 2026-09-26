-- HostPanel service — schema for integration into Priv8Hash (raw SQL, like agent_plans/agent_credits).
-- Idempotent: safe to run more than once.
-- Run as:  sudo -u postgres psql -d priv8hash -f hostpanel_schema.sql

-- ============================================================
-- 1) Plans (DB-driven pricing, admin-editable — mirrors agent_plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS hostpanel_plans (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL UNIQUE,        -- machine name, e.g. 'basic'
  display_name  VARCHAR(100) NOT NULL,
  price_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,    -- monthly price
  -- self_service = client can create/link cPanels + manage protection themselves.
  -- managed      = admin provisions; client only views status + files.
  self_service  BOOLEAN NOT NULL DEFAULT true,
  max_sites     INTEGER NOT NULL DEFAULT 1,          -- how many cPanel accounts allowed
  max_domains   INTEGER NOT NULL DEFAULT 1,          -- addon domains per site
  features      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2) Subscriptions (one active row per user — mirrors agent_credits)
-- ============================================================
CREATE TABLE IF NOT EXISTS hostpanel_subscriptions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       INTEGER REFERENCES hostpanel_plans(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | expired | cancelled
  sites_used    INTEGER NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  auto_renew    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hostpanel_sub_user_unique ON hostpanel_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_hostpanel_sub_user ON hostpanel_subscriptions (user_id);

-- ============================================================
-- 3) cPanel accounts owned by a user (replaces the JSON ownership/shares files)
-- ============================================================
CREATE TABLE IF NOT EXISTS hostpanel_accounts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cpanel_user   VARCHAR(64) NOT NULL UNIQUE,   -- the WHM/cPanel username
  domain        VARCHAR(255) NOT NULL,
  plan_id       INTEGER REFERENCES hostpanel_plans(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | suspended | terminated
  managed       BOOLEAN NOT NULL DEFAULT false,          -- provisioned by admin (managed plan)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostpanel_acct_user ON hostpanel_accounts (user_id);

-- ============================================================
-- Seed plans (idempotent via ON CONFLICT on unique name)
-- ============================================================
INSERT INTO hostpanel_plans (name, display_name, price_usd, self_service, max_sites, max_domains, features, sort_order)
VALUES
  ('basic',   'Basic Hosting',    9.00,  true,  1, 2,
     '{"ssl":true,"antibot":true,"dkim":true,"support":"community"}'::jsonb, 1),
  ('pro',     'Pro Hosting',      29.00, true,  5, 10,
     '{"ssl":true,"antibot":true,"dkim":true,"ratelimit":true,"dmarc":true,"support":"priority"}'::jsonb, 2),
  ('managed', 'Managed Hosting',  79.00, false, 10, 25,
     '{"ssl":true,"antibot":true,"dkim":true,"ratelimit":true,"dmarc":true,"managed_setup":true,"support":"dedicated"}'::jsonb, 3)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_usd    = EXCLUDED.price_usd,
  self_service = EXCLUDED.self_service,
  max_sites    = EXCLUDED.max_sites,
  max_domains  = EXCLUDED.max_domains,
  features     = EXCLUDED.features,
  sort_order   = EXCLUDED.sort_order;

-- Show result
SELECT id, name, display_name, price_usd, self_service, max_sites FROM hostpanel_plans ORDER BY sort_order;
