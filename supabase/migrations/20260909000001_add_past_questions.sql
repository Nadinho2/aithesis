-- ══════════════════════════════════════════════════════════
-- MIGRATION: Past Questions Bank (admin-seeded practice quiz)
-- ══════════════════════════════════════════════════════════

-- ─── Past Questions (question bank, seeded by admins) ─────
CREATE TABLE IF NOT EXISTS public.past_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'university' CHECK (category IN ('university', 'waec', 'neco', 'jamb')),
  university text,
  course text,
  level text,
  year text,
  subject text,
  question_type text NOT NULL DEFAULT 'objectives' CHECK (question_type IN ('objectives', 'theory')),
  question text NOT NULL,
  options jsonb DEFAULT '[]',
  answer text NOT NULL,
  explanation text,
  marks int DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.past_questions TO authenticated;
GRANT ALL ON public.past_questions TO service_role;

ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read published questions"
  ON public.past_questions FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE INDEX idx_past_questions_category ON public.past_questions(category);
CREATE INDEX idx_past_questions_course ON public.past_questions(course);
CREATE INDEX idx_past_questions_university ON public.past_questions(university);
CREATE INDEX idx_past_questions_level ON public.past_questions(level);
CREATE INDEX idx_past_questions_subject ON public.past_questions(subject);
CREATE INDEX idx_past_questions_type ON public.past_questions(question_type);
CREATE INDEX idx_past_questions_status ON public.past_questions(status);

-- ─── Past Question Attempts (individual practice answers) ─
CREATE TABLE IF NOT EXISTS public.past_question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  question_id uuid NOT NULL REFERENCES public.past_questions(id) ON DELETE CASCADE,
  selected_answer text,
  is_correct boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.past_question_attempts TO authenticated;
GRANT ALL ON public.past_question_attempts TO service_role;

ALTER TABLE public.past_question_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own attempts"
  ON public.past_question_attempts FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_past_question_attempts_user_id ON public.past_question_attempts(user_id);
CREATE INDEX idx_past_question_attempts_question_id ON public.past_question_attempts(question_id);

-- ─── Learning Signals (aggregated weak areas per user) ────
CREATE TABLE IF NOT EXISTS public.learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  subject text NOT NULL,
  attempts int DEFAULT 0,
  correct int DEFAULT 0,
  weak_concepts jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, subject)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_signals TO authenticated;
GRANT ALL ON public.learning_signals TO service_role;

ALTER TABLE public.learning_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own learning signals"
  ON public.learning_signals FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_learning_signals_user_id ON public.learning_signals(user_id);
