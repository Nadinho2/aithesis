-- ══════════════════════════════════════════════════════════
-- MIGRATION: Upgrade assignments table to section-based structure
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS abstract text DEFAULT '',
  ADD COLUMN IF NOT EXISTS word_count_target int DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS academic_level text DEFAULT 'undergraduate',
  ADD COLUMN IF NOT EXISTS grading_target text DEFAULT 'B',
  ADD COLUMN IF NOT EXISTS title text DEFAULT '';
