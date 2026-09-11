-- ══════════════════════════════════════════════════════════
-- MIGRATION: Learning Signal Events (agentic connective tissue)
-- ══════════════════════════════════════════════════════════
-- Event-level source of truth for what a learner is struggling
-- with, so every AI touchpoint (Ask PADI, Study Planner, MicroCourse
-- suggestions, @PADI) reads and writes one shared record of activity.
--
-- Relationship to public.learning_signals:
--   learning_signals        = aggregated rollup keyed by subject
--                             (attempts / correct / weak_concepts),
--                             still used by existing readers.
--   learning_signal_events  = this table, the raw per-event feed.
--   "topic" here maps to "subject" in the aggregate when rolling up.
--
-- Weights encode relative strength (asking PADI for help clarifies
-- deeper confusion than a plain wrong answer):
--   wrong_answer        -> 1
--   ask_padi_click      -> 3 (stronger signal of confusion)
--   course_completed    -> 10 (strong positive signal)

CREATE TABLE IF NOT EXISTS public.learning_signal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  topic text NOT NULL,
  signal_type text NOT NULL
    CHECK (signal_type IN ('wrong_answer', 'ask_padi_click', 'course_completed')),
  weight int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_signal_events TO authenticated;
GRANT ALL ON public.learning_signal_events TO service_role;

ALTER TABLE public.learning_signal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own learning signal events"
  ON public.learning_signal_events FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_learning_signal_events_user_id ON public.learning_signal_events(user_id);
CREATE INDEX idx_learning_signal_events_signal_type ON public.learning_signal_events(signal_type);
CREATE INDEX idx_learning_signal_events_user_created
  ON public.learning_signal_events(user_id, created_at DESC);
