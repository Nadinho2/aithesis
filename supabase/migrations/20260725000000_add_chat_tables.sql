-- Chat tables for AI Chat feature
-- Part of the new mybrainpadi.com navigation structure

-- ─── Chats table ──────────────────────────────────────────────────────────

CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chats"
  ON public.chats FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_updated_at ON public.chats(updated_at DESC);

-- ─── Chat Messages table ──────────────────────────────────────────────────

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own chat messages"
  ON public.chat_messages FOR ALL
  USING (
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()::text)
  );

CREATE INDEX idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- ─── Coming Soon Notifications table ──────────────────────────────────────

CREATE TABLE public.coming_soon_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  feature TEXT NOT NULL,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT INSERT ON public.coming_soon_notifications TO authenticated;
GRANT INSERT ON public.coming_soon_notifications TO anon;
GRANT ALL ON public.coming_soon_notifications TO service_role;

ALTER TABLE public.coming_soon_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert notifications"
  ON public.coming_soon_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
