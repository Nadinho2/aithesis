-- ══════════════════════════════════════════════════════════
-- MIGRATION: Certifications (completion + demonstrated performance)
-- ══════════════════════════════════════════════════════════
-- Certificates are issued automatically from measurable data
-- (learning_signals practice scores + micro_course_completions),
-- never from an AI judgment call. The id (uuid) doubles as the
-- public, unguessable share token.

CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  recipient_name text,
  kind text NOT NULL CHECK (kind IN ('subject_mastery', 'path_completion')),
  title text NOT NULL,
  subtitle text,
  criteria jsonb NOT NULL DEFAULT '{}',
  ai_note text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificates_select_own"
  ON public.certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_issued_at ON public.certificates(issued_at);
