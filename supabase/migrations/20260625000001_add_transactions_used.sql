-- Add `used` column to transactions for pay-per-use model
-- When `used = false`, the payment is available for one generation
-- When `used = true`, the payment has been consumed

ALTER TABLE public.transactions 
  ADD COLUMN used BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing transactions as used so old payments don't grant unlimited access
UPDATE public.transactions SET used = true WHERE used = false;
