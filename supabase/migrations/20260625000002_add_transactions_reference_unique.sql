-- Add unique constraint on transactions.reference for upsert in verifyPayment
-- This allows initPayment to save a pending record before Paystack redirect,
-- and verifyPayment to upsert it to completed status.

-- First, deduplicate any existing rows with duplicate references (keep the newest)
DELETE FROM public.transactions t1
USING public.transactions t2
WHERE t1.reference IS NOT NULL
  AND t1.reference = t2.reference
  AND t1.created_at < t2.created_at;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_reference_key UNIQUE (reference);
