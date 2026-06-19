-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add side_hustles table
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.side_hustles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  answers jsonb DEFAULT '{}',
  suggestions jsonb DEFAULT '{}',
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_side_hustles_user_id ON public.side_hustles(user_id);

-- Add product availability column to user_limits
ALTER TABLE public.user_limits
  ADD COLUMN IF NOT EXISTS side_hustle_available int DEFAULT 0;
