-- Update followed user posted notification link trigger to include msgId query parameter
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
  SELECT a, 'Followed user posted', msg, 'info', '/app/investor-chat?msgId=' || NEW.id, false
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
      'url', '/app/investor-chat?msgId=' || NEW.id,
      'tag', 'info',
      'notification_type', 'info'
    )
  );

  RETURN NEW;
END;
$$;

-- Backfill old notifications to include msgId query parameter
DO $$
DECLARE
  r RECORD;
  parsed_sender TEXT;
  msg_id UUID;
BEGIN
  FOR r IN 
    SELECT id, message, created_at 
    FROM public.notifications 
    WHERE title = 'Followed user posted' AND link = '/app/investor-chat'
  LOOP
    -- The message is "SENDER_NAME posted a new update in Investor Chat."
    parsed_sender := substring(r.message from '^(.*) posted a new update in Investor Chat\.$');
    IF parsed_sender IS NOT NULL THEN
      -- Find the closest message by this sender within 3 minutes of the notification's created_at
      SELECT id INTO msg_id
      FROM public.investor_chat_messages
      WHERE lower(sender_name) = lower(parsed_sender)
        AND abs(extract(epoch from (created_at - r.created_at))) < 180
      ORDER BY abs(extract(epoch from (created_at - r.created_at))) ASC
      LIMIT 1;

      IF msg_id IS NOT NULL THEN
        UPDATE public.notifications
        SET link = '/app/investor-chat?msgId=' || msg_id
        WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;
