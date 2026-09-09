-- ══════════════════════════════════════════════════════════
-- MIGRATION: Community — post/comment editing + visibility
-- ══════════════════════════════════════════════════════════

-- Username surfaced on posts/comments (mirrors the Clerk username
-- collected at signup; backfilled on read when missing).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Audience targeting for posts.
--   all        → public (every university)
--   university → only same university
--   department → only same university + department
--   course     → only same university + level (course)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all'
  CHECK (visibility IN ('all', 'university', 'department', 'course'));

-- Own-post editing is allowed only within 6 hours of posting.
DROP POLICY IF EXISTS "community_posts_update_own" ON public.community_posts;
CREATE POLICY "community_posts_update_own"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text AND now() - created_at <= interval '6 hours');

-- Own-comment editing, same 6-hour window.
DROP POLICY IF EXISTS "community_comments_update_own" ON public.community_comments;
CREATE POLICY "community_comments_update_own"
  ON public.community_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text AND now() - created_at <= interval '6 hours');

CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON public.community_posts(visibility);
