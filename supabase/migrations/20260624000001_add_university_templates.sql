-- ══════════════════════════════════════════════════════════
-- MIGRATION: University templates for chapter structure patterns
-- ══════════════════════════════════════════════════════════

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.university_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name TEXT NOT NULL,
  referencing_style TEXT NOT NULL DEFAULT 'apa',
  font_style TEXT NOT NULL DEFAULT 'Times New Roman',
  font_size INTEGER NOT NULL DEFAULT 12,
  line_spacing TEXT NOT NULL DEFAULT '1.5',
  thesis_chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposal_chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (short_name)
);

GRANT SELECT ON public.university_templates TO authenticated;
GRANT ALL ON public.university_templates TO service_role;

ALTER TABLE public.university_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all templates" ON public.university_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER university_templates_updated_at
  BEFORE UPDATE ON public.university_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════
-- university_submissions table for student-submitted structures
-- ══════════════════════════════════════════════════════════

CREATE TABLE public.university_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name TEXT NOT NULL,
  department TEXT NOT NULL,
  chapter_structure TEXT NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'reviewed', 'added')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON public.university_submissions TO authenticated;
GRANT ALL ON public.university_submissions TO service_role;

ALTER TABLE public.university_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own submissions" ON public.university_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users view own submissions" ON public.university_submissions
  FOR SELECT
  USING (auth.uid() = submitted_by);
