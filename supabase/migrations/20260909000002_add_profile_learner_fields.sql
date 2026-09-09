-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add learner/profile fields to profiles
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS learner_type text CHECK (learner_type IN ('university', 'pre_university', 'professional')),
  ADD COLUMN IF NOT EXISTS exam_tracks jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS class_level text;
