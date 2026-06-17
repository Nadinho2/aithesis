-- ══════════════════════════════════════════════════════════
-- MIGRATION: Per-level thesis limits with countdown
-- Replaces old combined thesis_limit/thesis_used with
-- per-level columns that decrement on use.
-- ══════════════════════════════════════════════════════════

-- Add per-level available counters
ALTER TABLE public.user_limits 
  ADD COLUMN IF NOT EXISTS thesis_available_ug integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_available_masters integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_available_phd integer NOT NULL DEFAULT 0;

-- ══════════════════════════════════════════════════════════
-- can_generate: checks if the user has remaining drafts
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.can_generate(p_user_id TEXT, p_type TEXT, p_level TEXT DEFAULT 'undergraduate')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INT;
BEGIN
  IF p_type = 'thesis' THEN
    IF p_level = 'masters' THEN
      SELECT thesis_available_masters INTO v_available
      FROM public.user_limits WHERE user_id = p_user_id;
    ELSIF p_level = 'phd' THEN
      SELECT thesis_available_phd INTO v_available
      FROM public.user_limits WHERE user_id = p_user_id;
    ELSE
      SELECT thesis_available_ug INTO v_available
      FROM public.user_limits WHERE user_id = p_user_id;
    END IF;
    RETURN COALESCE(v_available, 0) > 0;
  ELSIF p_type = 'proposal' THEN
    SELECT proposal_limit - proposal_used INTO v_available
    FROM public.user_limits WHERE user_id = p_user_id;
    RETURN COALESCE(v_available, 0) > 0;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- increment_usage: decrements the available counter
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id TEXT, p_type TEXT, p_level TEXT DEFAULT 'undergraduate')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure row exists
  INSERT INTO public.user_limits (user_id, thesis_available_ug, proposal_limit, proposal_used)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_type = 'thesis' THEN
    IF p_level = 'masters' THEN
      UPDATE public.user_limits SET thesis_available_masters = GREATEST(0, thesis_available_masters - 1), updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_level = 'phd' THEN
      UPDATE public.user_limits SET thesis_available_phd = GREATEST(0, thesis_available_phd - 1), updated_at = now()
      WHERE user_id = p_user_id;
    ELSE
      UPDATE public.user_limits SET thesis_available_ug = GREATEST(0, thesis_available_ug - 1), updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
  ELSIF p_type = 'proposal' THEN
    UPDATE public.user_limits SET proposal_used = proposal_used + 1, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;
