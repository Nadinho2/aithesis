-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add student tools tables + product limits
-- ══════════════════════════════════════════════════════════

-- Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  references_list jsonb DEFAULT '[]',
  include_references boolean DEFAULT true,
  citation_style text DEFAULT 'apa_7',
  word_count int DEFAULT 0,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exams
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  subject_notes text NOT NULL,
  total_questions int NOT NULL,
  question_type text NOT NULL,
  questions jsonb DEFAULT '{}',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Presentations
CREATE TABLE IF NOT EXISTS public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  topic text NOT NULL,
  content text NOT NULL,
  slide_count int NOT NULL,
  slides jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- CVs
CREATE TABLE IF NOT EXISTS public.cvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  cv_data jsonb DEFAULT '{}',
  enhanced text,
  headshot_url text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON public.assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams(user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_user_id ON public.presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON public.cvs(user_id);

-- Add product availability columns to user_limits
ALTER TABLE public.user_limits
  ADD COLUMN IF NOT EXISTS assignment_available int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exam_available int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presentation_available int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cv_available int DEFAULT 0;
