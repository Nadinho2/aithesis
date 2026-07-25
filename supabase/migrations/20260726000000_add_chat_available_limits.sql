-- Adds chat_available column to user_limits for AI Chat usage tracking
-- Each chat message costs 1 credit from this pool

ALTER TABLE public.user_limits ADD COLUMN IF NOT EXISTS chat_available INTEGER NOT NULL DEFAULT 0;
