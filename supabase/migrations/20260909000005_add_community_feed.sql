-- ══════════════════════════════════════════════════════════
-- MIGRATION: Community feed (posts, likes, comments)
-- ══════════════════════════════════════════════════════════
-- author_id / user_id columns are text (Clerk IDs), matching the rest of the schema.

-- ─── Posts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  university text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_university ON public.community_posts(university);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);

-- ─── Likes (one per user per post) ────────────────────────
CREATE TABLE IF NOT EXISTS public.community_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ─── Comments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id, created_at);

-- ─── Grants ───────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
GRANT ALL ON public.community_likes TO service_role;
GRANT ALL ON public.community_comments TO service_role;

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_read"
  ON public.community_posts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "community_posts_insert_own"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY "community_posts_delete_own"
  ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid()::text);

CREATE POLICY "community_likes_read"
  ON public.community_likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "community_likes_insert_own"
  ON public.community_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "community_likes_delete_own"
  ON public.community_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "community_comments_read"
  ON public.community_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "community_comments_insert_own"
  ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY "community_comments_delete_own"
  ON public.community_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid()::text);
