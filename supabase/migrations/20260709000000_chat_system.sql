-- Migration: Real-Time Chat System messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view messages of their own conversation thread, admins can view all messages
DROP POLICY IF EXISTS "Select messages" ON public.messages;
CREATE POLICY "Select messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Insert policy: users can insert messages into their own conversation thread as themselves, admins can insert as themselves into any thread
DROP POLICY IF EXISTS "Insert messages" ON public.messages;
CREATE POLICY "Insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    (auth.uid() = sender_id AND (auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )))
  );

-- Update policy: users/admins can mark messages in their conversation thread as read
DROP POLICY IF EXISTS "Update messages" ON public.messages;
CREATE POLICY "Update messages" ON public.messages
  FOR UPDATE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ) WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Enable realtime (wrapped in a block to avoid breaking if already enabled or if publication structure differs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    -- Check if table is already in publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'messages' AND schemaname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;
