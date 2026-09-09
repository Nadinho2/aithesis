-- ══════════════════════════════════════════════════════════
-- MIGRATION: Study groups
-- ══════════════════════════════════════════════════════════
-- Free-form groups with optional academic tags, request-to-join
-- membership, group feed (posts + comments), members and files.
-- user_id / creator_id / author_id are text (Clerk IDs).

-- ─── Groups ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL,
  name text NOT NULL,
  description text,
  university text,
  department text,
  level text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_groups_created ON public.study_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_groups_university ON public.study_groups(university);
CREATE INDEX IF NOT EXISTS idx_study_groups_department ON public.study_groups(department);
CREATE INDEX IF NOT EXISTS idx_study_groups_level ON public.study_groups(level);

-- ─── Memberships (one row per user per group) ────────────
CREATE TABLE IF NOT EXISTS public.study_group_memberships (
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  role text NOT NULL DEFAULT 'member',   -- creator | member
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_memberships_user ON public.study_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_study_group_memberships_status ON public.study_group_memberships(group_id, status);

-- ─── Group feed: posts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_group_posts_group ON public.study_group_posts(group_id, created_at DESC);

-- ─── Group feed: comments ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_group_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.study_group_posts(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_group_comments_post ON public.study_group_comments(post_id, created_at);

-- ─── Files (max 10 MB, auto-expire after 4 months) ───────
CREATE TABLE IF NOT EXISTS public.study_group_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  uploader_id text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 months'),
  CONSTRAINT study_group_files_size_limit CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CONSTRAINT study_group_files_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_study_group_files_group ON public.study_group_files(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_group_files_expiry ON public.study_group_files(expires_at);

-- ─── Storage bucket (private; server uses service role) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-group-files', 'study-group-files', false)
ON CONFLICT (id) DO NOTHING;

-- ─── Grants ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_files TO authenticated;

GRANT ALL ON public.study_groups TO service_role;
GRANT ALL ON public.study_group_memberships TO service_role;
GRANT ALL ON public.study_group_posts TO service_role;
GRANT ALL ON public.study_group_comments TO service_role;
GRANT ALL ON public.study_group_files TO service_role;

-- ─── RLS (defense in depth; server fns use service role) ─
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_files ENABLE ROW LEVEL SECURITY;

-- Public directory: anyone authenticated can read groups
CREATE POLICY "study_groups_read"
  ON public.study_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_groups_insert_own"
  ON public.study_groups FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid()::text);

CREATE POLICY "study_groups_delete_creator"
  ON public.study_groups FOR DELETE TO authenticated
  USING (creator_id = auth.uid()::text);

CREATE POLICY "study_group_memberships_read"
  ON public.study_group_memberships FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_group_memberships_insert_own"
  ON public.study_group_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "study_group_memberships_update_own"
  ON public.study_group_memberships FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "study_group_memberships_delete_own"
  ON public.study_group_memberships FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "study_group_posts_read"
  ON public.study_group_posts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_group_posts_insert_own"
  ON public.study_group_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY "study_group_posts_delete_own"
  ON public.study_group_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid()::text);

CREATE POLICY "study_group_comments_read"
  ON public.study_group_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_group_comments_insert_own"
  ON public.study_group_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY "study_group_comments_delete_own"
  ON public.study_group_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid()::text);

CREATE POLICY "study_group_files_read"
  ON public.study_group_files FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "study_group_files_insert_own"
  ON public.study_group_files FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid()::text);

CREATE POLICY "study_group_files_delete_own"
  ON public.study_group_files FOR DELETE TO authenticated
  USING (uploader_id = auth.uid()::text);
