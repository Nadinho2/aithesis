-- Assessment tool: custom scenario analysis
-- Students write their own scenario and define custom response fields;
-- the AI answers each field with humanized, genuine analysis.

CREATE TABLE public.custom_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scenario_text TEXT NOT NULL,
  fields JSONB NOT NULL,
  -- fields structure: [{ "name": "Statement Type", "answer": "..." }]
  status TEXT CHECK (status IN ('pending', 'completed', 'failed'))
    DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_analyses TO authenticated;
GRANT ALL ON public.custom_analyses TO service_role;

ALTER TABLE public.custom_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own analyses"
  ON public.custom_analyses FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_custom_analyses_user_id ON public.custom_analyses(user_id);
CREATE INDEX idx_custom_analyses_created_at ON public.custom_analyses(created_at DESC);
