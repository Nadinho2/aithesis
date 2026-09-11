-- ══════════════════════════════════════════════════════════
-- MIGRATION: Study group invitations
-- ══════════════════════════════════════════════════════════
-- Members invite users (by email) into a group. The invited user
-- accepts or rejects from their dashboard; the invitation stays
-- pending on their dashboard until they respond.
-- invitee_id / invited_by are text (Clerk IDs).

CREATE TABLE IF NOT EXISTS public.study_group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  invitee_id text NOT NULL,
  invited_by text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT study_group_invitations_unique UNIQUE (group_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_invitations_invitee
  ON public.study_group_invitations(invitee_id, status);

CREATE INDEX IF NOT EXISTS idx_study_group_invitations_group
  ON public.study_group_invitations(group_id, status);

-- ─── Grants ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_invitations TO authenticated;
GRANT ALL ON public.study_group_invitations TO service_role;

-- ─── RLS (defense in depth; server fns use service role) ─
ALTER TABLE public.study_group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_group_invitations_read"
  ON public.study_group_invitations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_group_invitations_insert_own"
  ON public.study_group_invitations FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid()::text);

CREATE POLICY "study_group_invitations_update_invitee"
  ON public.study_group_invitations FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid()::text);
