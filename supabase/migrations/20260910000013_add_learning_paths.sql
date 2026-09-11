-- ══════════════════════════════════════════════════════════
-- MIGRATION: Learning Paths (curated sequences of MicroCourses)
-- ══════════════════════════════════════════════════════════
-- A learning path is an ordered list of existing micro_courses.
-- Progress is derived from micro_course_completions (passed).

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read published learning paths"
  ON public.learning_paths FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE INDEX idx_learning_paths_status ON public.learning_paths(status);

-- ─── Ordered steps linking a path to micro courses ─────────
CREATE TABLE IF NOT EXISTS public.learning_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.micro_courses(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  UNIQUE (path_id, position)
);

GRANT SELECT ON public.learning_path_steps TO authenticated;
GRANT ALL ON public.learning_path_steps TO service_role;

ALTER TABLE public.learning_path_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read steps of published paths"
  ON public.learning_path_steps FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learning_paths p
    WHERE p.id = path_id AND p.status = 'published'
  ));

CREATE INDEX idx_learning_path_steps_path ON public.learning_path_steps(path_id);
CREATE INDEX idx_learning_path_steps_course ON public.learning_path_steps(course_id);
