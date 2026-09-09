-- ══════════════════════════════════════════════════════════
-- MIGRATION: Mentorship (mentor profiles, requests, messages)
-- ══════════════════════════════════════════════════════════
-- user_id columns are text (Clerk IDs), matching the rest of the schema.

-- ─── Mentor profiles (one per user, admin-approved) ───────
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  headline text,
  bio text,
  expertise_areas jsonb NOT NULL DEFAULT '[]',
  university text,
  department text,
  level text,
  availability text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_profiles_status ON public.mentor_profiles(status);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_university ON public.mentor_profiles(university);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_department ON public.mentor_profiles(department);

-- ─── Mentorship requests (mentee -> mentor) ───────────────
CREATE TABLE IF NOT EXISTS public.mentorship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id text NOT NULL,
  mentor_id text NOT NULL,
  topic text,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentee ON public.mentorship_requests(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentor ON public.mentorship_requests(mentor_id);

-- One open request (pending or accepted) per mentee/mentor pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentorship_requests_open
  ON public.mentorship_requests(mentee_id, mentor_id)
  WHERE status IN ('pending', 'accepted');

-- ─── Mentorship messages (in-app thread per request) ──────
CREATE TABLE IF NOT EXISTS public.mentorship_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mentorship_requests(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_messages_request ON public.mentorship_messages(request_id, created_at);

-- ─── Grants ───────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_messages TO authenticated;
GRANT ALL ON public.mentor_profiles TO service_role;
GRANT ALL ON public.mentorship_requests TO service_role;
GRANT ALL ON public.mentorship_messages TO service_role;

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_profiles_read"
  ON public.mentor_profiles FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid()::text);

CREATE POLICY "mentor_profiles_insert_own"
  ON public.mentor_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "mentor_profiles_update_own"
  ON public.mentor_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "mentorship_requests_read"
  ON public.mentorship_requests FOR SELECT TO authenticated
  USING (mentee_id = auth.uid()::text OR mentor_id = auth.uid()::text);

CREATE POLICY "mentorship_requests_insert_own"
  ON public.mentorship_requests FOR INSERT TO authenticated
  WITH CHECK (mentee_id = auth.uid()::text);

CREATE POLICY "mentorship_requests_update_participant"
  ON public.mentorship_requests FOR UPDATE TO authenticated
  USING (mentee_id = auth.uid()::text OR mentor_id = auth.uid()::text);

CREATE POLICY "mentorship_messages_read"
  ON public.mentorship_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentorship_requests r
      WHERE r.id = request_id
        AND (r.mentee_id = auth.uid()::text OR r.mentor_id = auth.uid()::text)
    )
  );

CREATE POLICY "mentorship_messages_insert"
  ON public.mentorship_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.mentorship_requests r
      WHERE r.id = request_id
        AND (r.mentee_id = auth.uid()::text OR r.mentor_id = auth.uid()::text)
        AND r.status = 'accepted'
    )
  );
