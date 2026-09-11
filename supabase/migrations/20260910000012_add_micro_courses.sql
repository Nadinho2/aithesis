-- ══════════════════════════════════════════════════════════
-- MIGRATION: MicroCourses (self-produced short lessons)
-- ══════════════════════════════════════════════════════════
-- Lightweight, 5-10 minute lessons on practical skills. Content
-- is owned/produced by the team (not open to external uploads).
-- user_id is text (Clerk ID).

CREATE TABLE IF NOT EXISTS public.micro_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'study-skills' CHECK (category IN ('research', 'career', 'study-skills', 'wellbeing')),
  duration_minutes int NOT NULL DEFAULT 6,
  content jsonb NOT NULL DEFAULT '[]',
  check_questions jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.micro_courses TO authenticated;
GRANT ALL ON public.micro_courses TO service_role;

ALTER TABLE public.micro_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read published micro courses"
  ON public.micro_courses FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE INDEX idx_micro_courses_status ON public.micro_courses(status);
CREATE INDEX idx_micro_courses_category ON public.micro_courses(category);

-- ─── MicroCourse completions (per-user check results) ──────
CREATE TABLE IF NOT EXISTS public.micro_course_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.micro_courses(id) ON DELETE CASCADE,
  check_score int NOT NULL DEFAULT 0,
  check_total int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.micro_course_completions TO authenticated;
GRANT ALL ON public.micro_course_completions TO service_role;

ALTER TABLE public.micro_course_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "micro_course_completions_select_own"
  ON public.micro_course_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "micro_course_completions_insert_own"
  ON public.micro_course_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "micro_course_completions_update_own"
  ON public.micro_course_completions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "micro_course_completions_delete_own"
  ON public.micro_course_completions FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE INDEX idx_micro_course_completions_user ON public.micro_course_completions(user_id);
CREATE INDEX idx_micro_course_completions_course ON public.micro_course_completions(course_id);

-- ─── Allow bookmarking micro courses in saved_items ────────
ALTER TABLE public.saved_items DROP CONSTRAINT IF EXISTS saved_items_item_type_check;
ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_item_type_check
  CHECK (item_type IN ('past_question', 'subject', 'study_plan', 'learning_path', 'micro_course'));
