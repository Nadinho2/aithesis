-- ══════════════════════════════════════════════════════════
-- MIGRATION: Ensure user_limits table exists with all columns
-- Run this in Supabase SQL Editor if auto-migration failed.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_limits (
  user_id text PRIMARY KEY,
  proposal_limit integer NOT NULL DEFAULT 0,
  proposal_used integer NOT NULL DEFAULT 0,
  thesis_available_ug integer NOT NULL DEFAULT 0,
  thesis_available_masters integer NOT NULL DEFAULT 0,
  thesis_available_phd integer NOT NULL DEFAULT 0,
  assignment_available integer NOT NULL DEFAULT 0,
  exam_available integer NOT NULL DEFAULT 0,
  presentation_available integer NOT NULL DEFAULT 0,
  cv_available integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS (but allow service_role full access)
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by server functions with service key)
CREATE POLICY "Service role full access"
  ON public.user_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
