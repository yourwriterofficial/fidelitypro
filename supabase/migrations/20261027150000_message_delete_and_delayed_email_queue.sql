-- Migration: Admin message deletion, linked notification cleanup,
-- delayed (5 minute) message email queue, and user transaction logging.
--
-- 1. public.messages had no DELETE policy, so admin deletes silently matched
--    0 rows under RLS. Admins may now delete support messages.
-- 2. notifications.source_message_id links a notification to the chat message
--    that produced it, so deleting the message removes the notification too.
-- 3. message_email_queue holds message-received emails for 5 minutes. A pg_cron
--    job dispatches due rows; deleting the message cancels its pending email.
-- 4. Users may log their own transactions (property purchases, staking, P2P),
--    which previously failed silently because only admins could insert.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. Admin delete policy on support messages ───────────────────────────────
DROP POLICY IF EXISTS "Delete messages" ON public.messages;
CREATE POLICY "Delete messages" ON public.messages
  FOR DELETE USING (public.is_admin());

-- ── 2. Link notifications to their source message ────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_message_id UUID;
CREATE INDEX IF NOT EXISTS idx_notifications_source_message_id
  ON public.notifications(source_message_id)
  WHERE source_message_id IS NOT NULL;

-- ── 3. Delayed email queue ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_message_id UUID NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  send_after TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending', 'sent', 'cancelled'])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_message_email_queue_due
  ON public.message_email_queue(send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_message_email_queue_source
  ON public.message_email_queue(source_message_id);

ALTER TABLE public.message_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage message email queue" ON public.message_email_queue;
CREATE POLICY "Admins manage message email queue" ON public.message_email_queue
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- The send time is enforced server-side so a client cannot skip the delay.
CREATE OR REPLACE FUNCTION public.enforce_message_email_delay()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.send_after := now() + interval '5 minutes';
  NEW.status := 'pending';
  NEW.sent_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_email_queue_enforce_delay ON public.message_email_queue;
CREATE TRIGGER message_email_queue_enforce_delay
BEFORE INSERT ON public.message_email_queue
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_email_delay();

-- ── 4. On message delete: remove linked notifications, cancel pending email ──
CREATE OR REPLACE FUNCTION public.cleanup_deleted_message_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications WHERE source_message_id = OLD.id;

  UPDATE public.message_email_queue
     SET status = 'cancelled'
   WHERE source_message_id = OLD.id
     AND status = 'pending';

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_deleted_message_side_effects() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_cleanup_on_delete ON public.messages;
CREATE TRIGGER messages_cleanup_on_delete
AFTER DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_message_side_effects();

DROP TRIGGER IF EXISTS direct_messages_cleanup_on_delete ON public.direct_messages;
CREATE TRIGGER direct_messages_cleanup_on_delete
AFTER DELETE ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_message_side_effects();

-- ── 5. Dispatcher: sends due emails via the send-email Edge Function ─────────
CREATE OR REPLACE FUNCTION public.process_message_email_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  sent_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT q.*
      FROM public.message_email_queue q
     WHERE q.status = 'pending'
       AND q.send_after <= now()
     ORDER BY q.send_after
     LIMIT 50
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Defensive re-check: never email about a message that no longer exists.
    IF NOT EXISTS (SELECT 1 FROM public.messages WHERE id = r.source_message_id)
       AND NOT EXISTS (SELECT 1 FROM public.direct_messages WHERE id = r.source_message_id) THEN
      UPDATE public.message_email_queue SET status = 'cancelled' WHERE id = r.id;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := 'https://eofbdmhjirbtidtucqkp.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', coalesce(nullif(current_setting('app.settings.anon_key', true), ''), 'SUPABASE_ANON_KEY'),
        'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.settings.anon_key', true), ''), 'SUPABASE_ANON_KEY')
      ),
      body := jsonb_build_object('to', r.recipient, 'subject', r.subject, 'html', r.html)
    );

    INSERT INTO public.email_logs (recipient, subject, body)
    VALUES (r.recipient, r.subject, r.html);

    UPDATE public.message_email_queue
       SET status = 'sent', sent_at = now()
     WHERE id = r.id;

    sent_count := sent_count + 1;
  END LOOP;

  RETURN sent_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_message_email_queue() FROM PUBLIC, anon, authenticated;

-- Run every minute; worst-case delivery is send_after + ~60s.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-message-email-queue';
  PERFORM cron.schedule(
    'process-message-email-queue',
    '* * * * *',
    'SELECT public.process_message_email_queue();'
  );
END;
$$;

-- ── 6. Users can log their own transactions ──────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 7. Realtime: publish tables the client subscribes to ─────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions', 'deposits', 'direct_messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
