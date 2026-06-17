-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add per-level thesis limits to user_limits
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.user_limits 
  ADD COLUMN IF NOT EXISTS thesis_limit_ug integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_used_ug integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_limit_masters integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_used_masters integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_limit_phd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thesis_used_phd integer NOT NULL DEFAULT 0;

-- ══════════════════════════════════════════════════════════
-- UPDATE can_generate to accept p_level
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.can_generate(p_user_id TEXT, p_type TEXT, p_level TEXT DEFAULT 'undergraduate')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_used INT;
BEGIN
  IF p_type = 'thesis' THEN
    IF p_level = 'masters' THEN
      SELECT thesis_limit_masters, thesis_used_masters INTO v_limit, v_used
      FROM public.user_limits WHERE user_id = p_user_id;
    ELSIF p_level = 'phd' THEN
      SELECT thesis_limit_phd, thesis_used_phd INTO v_limit, v_used
      FROM public.user_limits WHERE user_id = p_user_id;
    ELSE
      -- undergraduate (default)
      SELECT thesis_limit_ug, thesis_used_ug INTO v_limit, v_used
      FROM public.user_limits WHERE user_id = p_user_id;
    END IF;
    
    -- Fallback to old combined thesis_limit if per-level is 0
    IF COALESCE(v_limit, 0) = 0 THEN
      SELECT thesis_limit, thesis_used INTO v_limit, v_used
      FROM public.user_limits WHERE user_id = p_user_id;
    END IF;
  ELSIF p_type = 'proposal' THEN
    SELECT proposal_limit, proposal_used INTO v_limit, v_used
    FROM public.user_limits WHERE user_id = p_user_id;
  ELSE
    RETURN false;
  END IF;
  
  RETURN COALESCE(v_used, 0) < COALESCE(v_limit, 0);
END;
$$;

-- ══════════════════════════════════════════════════════════
-- UPDATE increment_usage to accept p_level
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id TEXT, p_type TEXT, p_level TEXT DEFAULT 'undergraduate')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure row exists
  INSERT INTO public.user_limits (user_id, thesis_limit_ug, thesis_used_ug, proposal_limit, proposal_used)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_type = 'thesis' THEN
    IF p_level = 'masters' THEN
      UPDATE public.user_limits SET thesis_used_masters = thesis_used_masters + 1, updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_level = 'phd' THEN
      UPDATE public.user_limits SET thesis_used_phd = thesis_used_phd + 1, updated_at = now()
      WHERE user_id = p_user_id;
    ELSE
      UPDATE public.user_limits SET thesis_used_ug = thesis_used_ug + 1, updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
    
    -- Also increment old combined counter for backward compat
    UPDATE public.user_limits SET thesis_used = thesis_used + 1
    WHERE user_id = p_user_id;
  ELSIF p_type = 'proposal' THEN
    UPDATE public.user_limits SET proposal_used = proposal_used + 1, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;
