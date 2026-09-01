-- Migration: Notify admins on new user registration (In-App Notification + Web Push via pg_net)

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_user_signup()
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
  -- Do not notify if the new user is an admin
  IF NEW.is_admin = true THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT id) INTO admin_ids
  FROM public.profiles
  WHERE is_admin = true;

  IF admin_ids IS NULL OR array_length(admin_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(NULLIF(NEW.name, ''), NEW.email, 'A new user');
  msg := display_name || ' just registered on the platform.';

  -- 1. Insert in-app notifications for all admins
  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  SELECT a, 'New User Registered', msg, 'alert', '/admin/users', false
  FROM unnest(admin_ids) AS a;

  -- 2. Dispatch push notification via pg_net to send-push Edge Function
  PERFORM net.http_post(
    url := 'https://eofbdmhjirbtidtucqkp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY'
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(admin_ids),
      'title', 'New User Registered',
      'body', msg,
      'url', '/admin/users',
      'tag', 'new-user',
      'notification_type', 'alert'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_notify_admins_on_insert ON public.profiles;
CREATE TRIGGER profiles_notify_admins_on_insert
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_user_signup();
