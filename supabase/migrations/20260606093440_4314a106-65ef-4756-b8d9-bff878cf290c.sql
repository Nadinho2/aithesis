
CREATE TABLE public.theses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'undergraduate',
  department TEXT,
  area_of_interest TEXT,
  country TEXT,
  research_type TEXT,
  abstract TEXT,
  chapters JSONB NOT NULL DEFAULT '{}'::jsonb,
  references_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  word_count INTEGER NOT NULL DEFAULT 0,
  target_words INTEGER NOT NULL DEFAULT 8000,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.theses TO authenticated;
GRANT ALL ON public.theses TO service_role;

ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY theses_own_all ON public.theses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER theses_updated_at
  BEFORE UPDATE ON public.theses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX theses_user_created_idx ON public.theses(user_id, created_at DESC);
