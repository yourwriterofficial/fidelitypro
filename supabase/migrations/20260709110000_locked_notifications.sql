-- Migration: Add locked_notifications settings to settings table
INSERT INTO public.settings (key, value)
VALUES (
  'locked_notifications',
  '{"email_info":false,"email_success":false,"email_warning":true,"email_alert":true,"push_info":false,"push_success":false,"push_warning":true,"push_alert":true}'
)
ON CONFLICT (key) DO NOTHING;
