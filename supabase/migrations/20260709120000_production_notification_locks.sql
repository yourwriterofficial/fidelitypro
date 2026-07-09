-- 1. Enforce admin locks at DB level on notification_preferences table
CREATE OR REPLACE FUNCTION enforce_locked_notifications()
RETURNS TRIGGER AS $$
DECLARE
  locked_json JSONB;
BEGIN
  -- Fetch the locked_notifications json value
  SELECT value::JSONB INTO locked_json FROM public.settings WHERE key = 'locked_notifications';
  
  IF locked_json IS NOT NULL THEN
    IF (locked_json->>'email_info')::BOOLEAN = true THEN NEW.email_info := true; END IF;
    IF (locked_json->>'email_success')::BOOLEAN = true THEN NEW.email_success := true; END IF;
    IF (locked_json->>'email_warning')::BOOLEAN = true THEN NEW.email_warning := true; END IF;
    IF (locked_json->>'email_alert')::BOOLEAN = true THEN NEW.email_alert := true; END IF;
    IF (locked_json->>'push_info')::BOOLEAN = true THEN NEW.push_info := true; END IF;
    IF (locked_json->>'push_success')::BOOLEAN = true THEN NEW.push_success := true; END IF;
    IF (locked_json->>'push_warning')::BOOLEAN = true THEN NEW.push_warning := true; END IF;
    IF (locked_json->>'push_alert')::BOOLEAN = true THEN NEW.push_alert := true; END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_locked_notifications_trigger ON public.notification_preferences;
CREATE TRIGGER enforce_locked_notifications_trigger
BEFORE INSERT OR UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION enforce_locked_notifications();

-- 2. Automatically apply locks to all existing users when setting changes
CREATE OR REPLACE FUNCTION apply_new_notification_locks()
RETURNS TRIGGER AS $$
DECLARE
  locked_json JSONB;
BEGIN
  IF NEW.key = 'locked_notifications' THEN
    locked_json := NEW.value::JSONB;
    
    UPDATE public.notification_preferences
    SET
      email_info = CASE WHEN (locked_json->>'email_info')::BOOLEAN = true THEN true ELSE email_info END,
      email_success = CASE WHEN (locked_json->>'email_success')::BOOLEAN = true THEN true ELSE email_success END,
      email_warning = CASE WHEN (locked_json->>'email_warning')::BOOLEAN = true THEN true ELSE email_warning END,
      email_alert = CASE WHEN (locked_json->>'email_alert')::BOOLEAN = true THEN true ELSE email_alert END,
      push_info = CASE WHEN (locked_json->>'push_info')::BOOLEAN = true THEN true ELSE push_info END,
      push_success = CASE WHEN (locked_json->>'push_success')::BOOLEAN = true THEN true ELSE push_success END,
      push_warning = CASE WHEN (locked_json->>'push_warning')::BOOLEAN = true THEN true ELSE push_warning END,
      push_alert = CASE WHEN (locked_json->>'push_alert')::BOOLEAN = true THEN true ELSE push_alert END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS apply_new_notification_locks_trigger ON public.settings;
CREATE TRIGGER apply_new_notification_locks_trigger
AFTER INSERT OR UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION apply_new_notification_locks();
