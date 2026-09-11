-- ══════════════════════════════════════════════════════════
-- MIGRATION: @PADI in Study Groups (flag AI-authored comments)
-- ══════════════════════════════════════════════════════════
-- Marks a study_group_comments row as authored by PADI so the
-- feed UI can render it distinctly from student comments.

ALTER TABLE public.study_group_comments
  ADD COLUMN IF NOT EXISTS is_padi boolean NOT NULL DEFAULT false;
