-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add used column to transactions for pay-per-use
-- Each completed transaction = 1 generation credit.
-- After generation, used is set to true.
-- ══════════════════════════════════════════════════════════

-- Step 1: Add the column (skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'used'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN used boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Step 2: Ensure pending transactions also have used=false (they shouldn't count)
-- completed transactions stay at their current value

-- Step 3: Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_product_used
  ON public.transactions (user_id, product, status, used)
  WHERE status = 'completed' AND used = false;
