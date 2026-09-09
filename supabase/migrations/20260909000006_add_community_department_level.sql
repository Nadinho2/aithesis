-- ══════════════════════════════════════════════════════════
-- MIGRATION: Community feed — department & level scopes
-- ══════════════════════════════════════════════════════════
-- Denormalise the author's department + level onto posts so the
-- feed can be filtered by "Department" and "Course" (level).

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS level text;

CREATE INDEX IF NOT EXISTS idx_community_posts_department ON public.community_posts(department);
CREATE INDEX IF NOT EXISTS idx_community_posts_level ON public.community_posts(level);
