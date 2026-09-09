-- ══════════════════════════════════════════════════════════
-- MIGRATION: Faculties (University → Faculty → Department)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

-- Departments become children of a faculty (nullable to keep legacy rows valid).
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS faculty_id uuid REFERENCES public.faculties(id) ON DELETE SET NULL;

-- Store the faculty name on the user profile (mirrors university/department).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS faculty text;

GRANT SELECT ON public.faculties TO authenticated;
GRANT ALL ON public.faculties TO service_role;

ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read faculties"
  ON public.faculties FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_faculties_university_id ON public.faculties(university_id);
CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON public.departments(faculty_id);
