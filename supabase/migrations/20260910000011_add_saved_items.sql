-- ══════════════════════════════════════════════════════════
-- MIGRATION: Saved items (bookmarks for the Learn area)
-- ══════════════════════════════════════════════════════════
-- Polymorphic bookmarks: subjects, past questions, study-plan
-- items, learning paths. user_id is text (Clerk ID).

CREATE TABLE IF NOT EXISTS public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('past_question', 'subject', 'study_plan', 'learning_path')),
  item_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user ON public.saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_type ON public.saved_items(user_id, item_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_items_select_own"
  ON public.saved_items FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "saved_items_insert_own"
  ON public.saved_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "saved_items_update_own"
  ON public.saved_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "saved_items_delete_own"
  ON public.saved_items FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);
