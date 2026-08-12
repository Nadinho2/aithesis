-- ═══════════════════════════════════════════════════════════
-- Referral system fix: Clerk TEXT user_ids + 2-tier commission
-- ═══════════════════════════════════════════════════════════
-- Problems this fixes:
--   1) referral_* tables used UUID REFERENCES auth.users(id),
--      but the app authenticates with Clerk (TEXT ids like user_2...).
--      Every insert was silently failing.
--   2) No way to distinguish partner types (standard/ambassador/influencer)
--      or L1 vs L2 earnings.
-- ═══════════════════════════════════════════════════════════

-- 1) Drop all FK constraints referencing auth.users in public schema
--    (the app uses Clerk, so auth.users is never populated).
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.confrelid = 'auth.users'::regclass
      AND con.contype = 'f'
      AND rel.relnamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2) Drop RLS policies that reference the columns we are about to alter.
--    (Postgres refuses to change a column type while a policy depends on it.)
DROP POLICY IF EXISTS "service_role_all_referral_codes" ON public.referral_codes;
DROP POLICY IF EXISTS "users_read_own_referral_code" ON public.referral_codes;
DROP POLICY IF EXISTS "service_role_all_referral_relationships" ON public.referral_relationships;
DROP POLICY IF EXISTS "service_role_all_referral_earnings" ON public.referral_earnings;
DROP POLICY IF EXISTS "users_read_own_earnings" ON public.referral_earnings;
DROP POLICY IF EXISTS "service_role_all_wallets" ON public.wallets;
DROP POLICY IF EXISTS "users_read_own_wallet" ON public.wallets;
DROP POLICY IF EXISTS "service_role_all_withdrawal_requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "users_read_own_withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "users_insert_own_withdrawals" ON public.withdrawal_requests;

-- 3) Convert user_id columns uuid -> text (Clerk IDs).
ALTER TABLE public.referral_codes        ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.referral_relationships ALTER COLUMN referrer_id TYPE text USING referrer_id::text;
ALTER TABLE public.referral_relationships ALTER COLUMN referred_id TYPE text USING referred_id::text;
ALTER TABLE public.referral_earnings     ALTER COLUMN referrer_id TYPE text USING referrer_id::text;
ALTER TABLE public.referral_earnings     ALTER COLUMN referred_id TYPE text USING referred_id::text;
ALTER TABLE public.wallets               ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.withdrawal_requests   ALTER COLUMN user_id TYPE text USING user_id::text;

-- 4) Add code_type to referral_codes (drives commission + bonus logic).
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS code_type TEXT NOT NULL DEFAULT 'standard'
  CHECK (code_type IN ('standard', 'ambassador', 'influencer'));

ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 5) Add level to referral_earnings ('L1' = direct, 'L2' = upline override).
ALTER TABLE public.referral_earnings
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'L1'
  CHECK (level IN ('L1', 'L2'));

-- 6) Ambassador / influencer application table.
CREATE TABLE IF NOT EXISTS public.referral_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  school TEXT,
  department TEXT,
  level TEXT,
  social_handles TEXT,
  promo_plan TEXT,
  requested_code TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) Indexes for the new columns/table.
CREATE INDEX IF NOT EXISTS idx_referral_codes_code_type ON public.referral_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_level ON public.referral_earnings(level);
CREATE INDEX IF NOT EXISTS idx_referral_applications_status ON public.referral_applications(status);
CREATE INDEX IF NOT EXISTS idx_referral_applications_user_id ON public.referral_applications(user_id);

-- 8) Recreate RLS policies.
--    service_role (used by all server functions) — full access.
CREATE POLICY "service_role_all_referral_codes" ON public.referral_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_referral_relationships" ON public.referral_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_referral_earnings" ON public.referral_earnings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_wallets" ON public.wallets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_withdrawal_requests" ON public.withdrawal_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

--    user policies (kept for parity; the app reads via server functions,
--    but these remain harmless and use a ::text cast to match Clerk ids).
CREATE POLICY "users_read_own_referral_code" ON public.referral_codes
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "users_read_own_earnings" ON public.referral_earnings
  FOR SELECT USING (auth.uid()::text = referrer_id);
CREATE POLICY "users_read_own_wallet" ON public.wallets
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "users_read_own_withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "users_insert_own_withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 9) Grants + RLS for the new applications table.
GRANT ALL ON public.referral_applications TO service_role;
ALTER TABLE public.referral_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_referral_applications" ON public.referral_applications
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "users_read_own_application" ON public.referral_applications
  FOR SELECT USING (auth.uid()::text = user_id);
