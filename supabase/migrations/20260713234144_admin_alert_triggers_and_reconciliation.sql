-- Reconciles tables that existed live but had no migration file, adds
-- server-side (Postgres trigger) fan-out for the two admin alert cases that
-- were previously entirely client-side (only fired while a specific admin
-- had a specific page open), adds a notification delivery log, and adds
-- target_user_id to investor_chat_follows so a followed user's posts still
-- match after they rename themselves.
--
-- (admin_watched_users itself already has its own migration,
-- 20260712134701_create_admin_watched_users.sql — not repeated here.)

-- ── 1. Schema reconciliation: tables that existed live with no migration ──

CREATE TABLE IF NOT EXISTS public.user_page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_page_visits_user_id ON public.user_page_visits(user_id);

ALTER TABLE public.user_page_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own page visits" ON public.user_page_visits;
CREATE POLICY "Users can insert their own page visits" ON public.user_page_visits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all page visits" ON public.user_page_visits;
CREATE POLICY "Admins can view all page visits" ON public.user_page_visits
  FOR SELECT USING (is_admin());


CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type = ANY (ARRAY['info', 'success', 'warning', 'error', 'alert'])),
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (is_admin());
-- "Users can insert own notifications" has its own migration,
-- 20260712150825_allow_users_insert_own_notifications.sql — not repeated here.


-- ── 2. Consolidate the two follow/watch tables where they overlap ─────────
-- investor_chat_follows keys on a free-text display name because it must
-- also support following simulated bot personas (no real profile row) — but
-- for real investors that means a follow silently breaks if they rename.
-- Resolving to a profile id at follow-time (see InvestorChat.tsx/AdminChat.tsx)
-- lets matching prefer the id and fall back to the name only for personas.
ALTER TABLE public.investor_chat_follows
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_investor_chat_follows_target_user_id ON public.investor_chat_follows(target_user_id);
CREATE INDEX IF NOT EXISTS idx_investor_chat_follows_target_name ON public.investor_chat_follows(lower(target_name));


-- ── 3. Notification delivery log ───────────────────────────────────────────
-- Records each push-send attempt per recipient/subscription so "admin says
-- push isn't arriving" is diagnosable from the delivery log instead of
-- requiring a full code investigation.
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_title TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'push',
  status TEXT NOT NULL CHECK (status = ANY (ARRAY['sent', 'failed', 'no_subscription'])),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id ON public.notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created_at ON public.notification_deliveries(created_at DESC);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view delivery log" ON public.notification_deliveries;
CREATE POLICY "Admins can view delivery log" ON public.notification_deliveries
  FOR SELECT USING (is_admin());
-- No insert/update/delete policy for regular roles: only the send-push edge
-- function (using the service role, which bypasses RLS) writes here.


-- ── 4. Server-side fan-out triggers ────────────────────────────────────────
-- Both triggers call the send-push edge function directly via pg_net so
-- delivery no longer depends on any admin having a browser tab open — the
-- entire point of a push notification is reaching someone who isn't looking
-- at the app right now.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_admins_on_investor_chat_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_ids UUID[];
  msg TEXT;
BEGIN
  SELECT array_agg(DISTINCT f.admin_id) INTO admin_ids
  FROM public.investor_chat_follows f
  WHERE (
    (NEW.sender_id IS NOT NULL AND f.target_user_id = NEW.sender_id)
    OR (f.target_user_id IS NULL AND lower(f.target_name) = lower(NEW.sender_name))
  )
  AND (NEW.sender_id IS NULL OR f.admin_id <> NEW.sender_id);

  IF admin_ids IS NULL THEN
    RETURN NEW;
  END IF;

  msg := NEW.sender_name || ' posted a new update in Investor Chat.';

  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  SELECT a, 'Followed user posted', msg, 'info', '/app/investor-chat', false
  FROM unnest(admin_ids) AS a;

  PERFORM net.http_post(
    url := 'https://eofbdmhjirbtidtucqkp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY'
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(admin_ids),
      'title', 'Followed user posted',
      'body', msg,
      'url', '/app/investor-chat',
      'tag', 'info',
      'notification_type', 'info'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investor_chat_messages_notify_follows ON public.investor_chat_messages;
CREATE TRIGGER investor_chat_messages_notify_follows
AFTER INSERT ON public.investor_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_investor_chat_post();


CREATE OR REPLACE FUNCTION public.notify_admins_on_watched_user_online()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_ids UUID[];
  display_name TEXT;
  msg TEXT;
BEGIN
  IF NEW.last_seen IS NULL THEN
    RETURN NEW;
  END IF;
  -- A gap of 3+ minutes since the last update is used as a proxy for "was
  -- away, just came back" — last_seen is throttled client-side to at most
  -- once every 5 seconds while actively browsing, so a small gap is just
  -- normal navigation, not a fresh online transition.
  IF OLD.last_seen IS NOT NULL AND NEW.last_seen - OLD.last_seen < interval '3 minutes' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT w.admin_id) INTO admin_ids
  FROM public.admin_watched_users w
  WHERE w.target_user_id = NEW.id;

  IF admin_ids IS NULL THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(NULLIF(NEW.name, ''), NEW.email, 'A watched user');
  msg := display_name || ' just came online.';

  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  SELECT a, 'Watched user online', msg, 'alert', '/admin/users', false
  FROM unnest(admin_ids) AS a;

  PERFORM net.http_post(
    url := 'https://eofbdmhjirbtidtucqkp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY'
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(admin_ids),
      'title', 'Watched user online',
      'body', msg,
      'url', '/admin/users',
      'tag', 'alert',
      'notification_type', 'alert'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_notify_watched_online ON public.profiles;
CREATE TRIGGER profiles_notify_watched_online
AFTER UPDATE OF last_seen ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_watched_user_online();
