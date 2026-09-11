-- ══════════════════════════════════════════════════════════
-- MIGRATION: Chat message suggestions (Level 1 soft routing)
-- ══════════════════════════════════════════════════════════
-- Lets an assistant message carry an optional routing suggestion
-- (e.g. "open Topic Discovery pre-filled with this topic") that
-- the chat UI renders as a clickable handoff button.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS suggestion jsonb;
