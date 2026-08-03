-- Adds assessment_available column to user_limits for Assessment tool usage tracking
-- Each assessment generation costs 1 credit from this pool (free by default)

ALTER TABLE public.user_limits ADD COLUMN IF NOT EXISTS assessment_available INTEGER NOT NULL DEFAULT 0;
