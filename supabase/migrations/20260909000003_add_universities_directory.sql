-- ══════════════════════════════════════════════════════════
-- MIGRATION: University / Department directory (admin-seeded)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

GRANT SELECT ON public.universities TO authenticated;
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.universities TO service_role;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read universities"
  ON public.universities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_departments_university_id ON public.departments(university_id);
