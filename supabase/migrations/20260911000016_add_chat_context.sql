-- ══════════════════════════════════════════════════════════
-- MIGRATION: Chat context (scoped AI threads, e.g. Ask PADI)
-- ══════════════════════════════════════════════════════════
-- Adds a context blob to chats so a thread can be opened with
-- pre-loaded context (a past question, a topic, etc.) that PADI
-- sees on every turn without the student re-explaining.

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}';
