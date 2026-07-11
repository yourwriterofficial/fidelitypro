-- Migration: Investor Group Chat System
CREATE TABLE IF NOT EXISTS public.investor_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_country TEXT NOT NULL DEFAULT 'US',
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  reply_to_id UUID REFERENCES public.investor_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.investor_chat_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(admin_id, target_name)
);

CREATE TABLE IF NOT EXISTS public.investor_chat_banned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL UNIQUE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.investor_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_chat_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_chat_banned ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Select messages" ON public.investor_chat_messages;
CREATE POLICY "Select messages" ON public.investor_chat_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Select follows" ON public.investor_chat_follows;
CREATE POLICY "Select follows" ON public.investor_chat_follows
  FOR SELECT USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Select banned" ON public.investor_chat_banned;
CREATE POLICY "Select banned" ON public.investor_chat_banned
  FOR SELECT USING (true);

-- Insert policies
DROP POLICY IF EXISTS "Insert messages" ON public.investor_chat_messages;
CREATE POLICY "Insert messages" ON public.investor_chat_messages
  FOR INSERT WITH CHECK (
    -- Any authenticated user can insert if not banned
    auth.role() = 'authenticated' AND NOT EXISTS (
      SELECT 1 FROM public.investor_chat_banned WHERE user_name = sender_name
    )
  );

DROP POLICY IF EXISTS "Insert follows" ON public.investor_chat_follows;
CREATE POLICY "Insert follows" ON public.investor_chat_follows
  FOR INSERT WITH CHECK (
    auth.uid() = admin_id AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Insert banned" ON public.investor_chat_banned;
CREATE POLICY "Insert banned" ON public.investor_chat_banned
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Update policies
DROP POLICY IF EXISTS "Update messages" ON public.investor_chat_messages;
CREATE POLICY "Update messages" ON public.investor_chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Delete policies
DROP POLICY IF EXISTS "Delete follows" ON public.investor_chat_follows;
CREATE POLICY "Delete follows" ON public.investor_chat_follows
  FOR DELETE USING (
    auth.uid() = admin_id
  );

DROP POLICY IF EXISTS "Delete banned" ON public.investor_chat_banned;
CREATE POLICY "Delete banned" ON public.investor_chat_banned
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Enable Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'investor_chat_messages' AND schemaname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.investor_chat_messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'investor_chat_banned' AND schemaname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.investor_chat_banned;
    END IF;
  END IF;
END $$;
