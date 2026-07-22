-- Seminars table + seminar_templates table
-- Also adds seminar_available column to user_limits
-- and extends generation_queue job_type check

-- ─── Seminars table ──────────────────────────────────────────────────────

CREATE TABLE public.seminars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  seminar_type TEXT NOT NULL CHECK (seminar_type IN (
    'seminar_journal',
    'seminar_departmental',
    'seminar_postgraduate',
    'seminar_technical',
    'seminar_book_review'
  )),
  academic_level TEXT NOT NULL DEFAULT 'undergraduate' CHECK (academic_level IN ('undergraduate', 'postgraduate', 'phd')),
  word_count INTEGER NOT NULL DEFAULT 0,
  target_words INTEGER NOT NULL DEFAULT 3000,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seminars TO authenticated;
GRANT ALL ON public.seminars TO service_role;

ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;

CREATE POLICY seminars_own_all ON public.seminars
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_seminars_user_id ON public.seminars(user_id);
CREATE INDEX idx_seminars_type ON public.seminars(seminar_type);

-- ─── Seminar Templates table ─────────────────────────────────────────────

CREATE TABLE public.seminar_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  sections JSONB NOT NULL,
  word_count_range TEXT NOT NULL,
  referencing_style TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

GRANT SELECT ON public.seminar_templates TO authenticated;
GRANT ALL ON public.seminar_templates TO service_role;

ALTER TABLE public.seminar_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY seminar_templates_read_all ON public.seminar_templates
  FOR SELECT TO authenticated
  USING (true);

-- ─── Seed seminar templates ──────────────────────────────────────────────

INSERT INTO public.seminar_templates (type, label, description, sections, word_count_range, referencing_style) VALUES
(
  'seminar_journal',
  'Journal / Conference Paper',
  'Formal academic paper for conference presentation or journal submission',
  '["Title","Author Details","Abstract","Keywords","1. Introduction","2. Literature Review","3. Methodology","4. Results and Findings","5. Discussion and Conclusion","Acknowledgements","References"]'::jsonb,
  '4,000 – 8,000 words',
  'apa'
),
(
  'seminar_departmental',
  'Departmental Seminar Paper',
  'Topic-based seminar paper for departmental presentation — no methodology required',
  '["Title Page","Abstract","Introduction","Main Body","Sub-theme 1","Sub-theme 2","Sub-theme 3","Conclusion","References"]'::jsonb,
  '2,000 – 5,000 words',
  'apa'
),
(
  'seminar_postgraduate',
  'Postgraduate Research Seminar',
  'Research plan seminar for Masters or PhD students — presents proposed study',
  '["Title","Abstract","Introduction and Background","Statement of the Problem","Research Objectives and Questions","Review of Related Literature","Theoretical Framework","Proposed Methodology","Expected Findings and Contributions","Research Timeline","References"]'::jsonb,
  '3,000 – 6,000 words',
  'apa'
),
(
  'seminar_technical',
  'Technical / Engineering Seminar',
  'Engineering and technology seminar presenting a problem, solution, and implementation plan',
  '["Title","Abstract","1. Introduction","2. Problem Statement","3. Review of Existing Solutions","4. Proposed Solution and System Design","5. Implementation Plan","6. Expected Results","7. Conclusion","References"]'::jsonb,
  '3,000 – 6,000 words',
  'ieee'
),
(
  'seminar_book_review',
  'Book Review Seminar',
  'Critical review and analysis of a book or major academic work',
  '["Title and Bibliographic Information","Author Background","Summary of the Work","Critical Analysis","Relevance to Course of Study","Strengths and Weaknesses","Personal Evaluation","Conclusion","References"]'::jsonb,
  '1,500 – 3,000 words',
  'apa'
);

-- ─── Add seminar_available to user_limits ────────────────────────────────

ALTER TABLE public.user_limits ADD COLUMN IF NOT EXISTS seminar_available INTEGER NOT NULL DEFAULT 0;

-- ─── Extend generation_queue job_type check ──────────────────────────────

ALTER TABLE public.generation_queue
DROP CONSTRAINT IF EXISTS generation_queue_job_type_check;

ALTER TABLE public.generation_queue
ADD CONSTRAINT generation_queue_job_type_check
CHECK (job_type IN ('thesis', 'proposal', 'assignment', 'seminar'));
