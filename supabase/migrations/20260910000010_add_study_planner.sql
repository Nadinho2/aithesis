-- ══════════════════════════════════════════════════════════
-- MIGRATION: Study planner
-- ══════════════════════════════════════════════════════════
-- Personal study plan tasks. user_id is text (Clerk ID).

CREATE TABLE IF NOT EXISTS public.study_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  subject text,
  notes text,
  due_date date NOT NULL,
  start_time text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'weak_area')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_user_date ON public.study_plan_tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_user_status ON public.study_plan_tasks(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_tasks TO authenticated;
GRANT ALL ON public.study_plan_tasks TO service_role;

ALTER TABLE public.study_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_plan_tasks_select_own"
  ON public.study_plan_tasks FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "study_plan_tasks_insert_own"
  ON public.study_plan_tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "study_plan_tasks_update_own"
  ON public.study_plan_tasks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "study_plan_tasks_delete_own"
  ON public.study_plan_tasks FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);
