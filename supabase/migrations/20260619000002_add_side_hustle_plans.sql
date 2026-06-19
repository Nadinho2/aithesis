-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add side_hustle_plans table for journey tracking
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.side_hustle_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  side_hustle_id uuid,
  title text NOT NULL,
  difficulty text DEFAULT 'Beginner',
  estimated_earnings text DEFAULT '',
  time_required text DEFAULT '',
  description text DEFAULT '',
  milestones jsonb DEFAULT '[]',
  current_step int DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_side_hustle_plans_user_id ON public.side_hustle_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_side_hustle_plans_status ON public.side_hustle_plans(status);
