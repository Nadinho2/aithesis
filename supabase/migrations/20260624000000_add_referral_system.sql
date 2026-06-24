-- Referral codes (one per user, auto-generated on signup)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which user referred which
CREATE TABLE IF NOT EXISTS public.referral_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Every commission earned per payment
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  payment_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  tool TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'credited')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet balance per user
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  paystack_recipient_code TEXT,
  paystack_transfer_id TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'success', 'failed')) DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_relationships_referrer ON public.referral_relationships(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_relationships_referred ON public.referral_relationships(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer ON public.referral_earnings(referrer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);

-- Grant access to service_role
GRANT ALL ON public.referral_codes TO service_role;
GRANT ALL ON public.referral_relationships TO service_role;
GRANT ALL ON public.referral_earnings TO service_role;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;

-- Enable RLS on all tables
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- User can read own referral code
CREATE POLICY "users_read_own_referral_code" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

-- User can read own earnings
CREATE POLICY "users_read_own_earnings" ON public.referral_earnings
  FOR SELECT USING (auth.uid() = referrer_id);

-- User can read own wallet
CREATE POLICY "users_read_own_wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- User can read own withdrawals
CREATE POLICY "users_read_own_withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert own withdrawals
CREATE POLICY "users_insert_own_withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
