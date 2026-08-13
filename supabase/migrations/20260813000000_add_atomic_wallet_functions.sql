-- Atomic wallet debit/refund functions.
--
-- Fixes a double-spend race in /api/withdrawal/request where the balance was
-- read (SELECT) then updated (UPDATE) in two non-atomic steps, allowing
-- concurrent requests to overdraw the wallet.
--
-- `balance = balance - p_amount` can only be expressed atomically on the DB
-- side (PostgREST PATCH sets literal values, not expressions), hence an RPC.

CREATE OR REPLACE FUNCTION public.deduct_wallet(p_user_id text, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  UPDATE public.wallets
     SET balance = balance - p_amount,
         total_withdrawn = total_withdrawn + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id
     AND balance >= p_amount
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RETURN NULL; -- insufficient balance or missing wallet row
  END IF;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_wallet(p_user_id text, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets
     SET balance = balance + p_amount,
         total_withdrawn = GREATEST(total_withdrawn - p_amount, 0),
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_wallet(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_wallet(text, integer) TO service_role;
