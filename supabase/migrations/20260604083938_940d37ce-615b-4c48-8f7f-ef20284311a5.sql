
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  level text NOT NULL DEFAULT 'undergraduate',
  department text,
  area_of_interest text,
  country text,
  research_type text,
  abstract text,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  references_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  word_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_own_all" ON public.proposals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX proposals_user_idx ON public.proposals(user_id, created_at DESC);
