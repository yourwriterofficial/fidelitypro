-- Migration: Comprehensive Server-Side Admin Push Notifications & Performance Indexes
-- Covers: Deposits, Withdrawals, Staking Orders, Property Requests, Property Investments,
-- Orders, P2P Escrow Orders, KYC Verifications, Support Chat Messages.
-- Also creates high-frequency query indexes to accelerate platform-wide data loading.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. Centralized Admin Push Notification Dispatcher ──────────────────────────
CREATE OR REPLACE FUNCTION public.dispatch_admin_push(
  p_title TEXT,
  p_body TEXT,
  p_link TEXT,
  p_tag TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_ids UUID[];
BEGIN
  SELECT array_agg(DISTINCT id) INTO admin_ids
  FROM public.profiles
  WHERE is_admin = true;

  IF admin_ids IS NULL OR array_length(admin_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- 1. Insert in-app notifications for all admins (bypasses client RLS via SECURITY DEFINER)
  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  SELECT a, p_title, p_body, 'alert', p_link, false
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
      'title', p_title,
      'body', p_body,
      'url', p_link,
      'tag', p_tag,
      'notification_type', 'alert'
    )
  );
END;
$$;


-- ── 2. Trigger: Deposits ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT name, email INTO u_name, u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Deposit] ' || user_display || ' ($' || to_char(NEW.amount, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') submitted a deposit of $' ||
            to_char(NEW.amount, 'FM999,999,990.00') ||
            COALESCE(' via ' || NULLIF(NEW.transaction_hash, ''), '') ||
            ' with payment proof.';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/deposits', 'admin-deposit');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deposits_notify_admins_trigger ON public.deposits;
CREATE TRIGGER deposits_notify_admins_trigger
AFTER INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_deposit();


-- ── 3. Trigger: Withdrawals ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT name, email INTO u_name, u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Withdrawal] ' || user_display || ' ($' || to_char(NEW.amount, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') requested a withdrawal of $' ||
            to_char(NEW.amount, 'FM999,999,990.00') ||
            COALESCE(' to ' || NULLIF(NEW.address, ''), '') || '.';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/withdrawals', 'admin-withdrawal');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawals_notify_admins_trigger ON public.withdrawals;
CREATE TRIGGER withdrawals_notify_admins_trigger
AFTER INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_withdrawal();


-- ── 4. Trigger: Staking Orders ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_staking_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT name, email INTO u_name, u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Staking] ' || user_display || ' ($' || to_char(NEW.amount, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') locked $' ||
            to_char(NEW.amount, 'FM999,999,990.00') || ' in ' ||
            COALESCE(NULLIF(NEW.product_name, ''), 'Staking Certificate') ||
            ' (' || COALESCE(NEW.lock_days::text, '0') || ' days @ ' ||
            COALESCE(NEW.apy::text, '0') || '% APY).';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/staking', 'admin-staking');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staking_orders_notify_admins_trigger ON public.staking_orders;
CREATE TRIGGER staking_orders_notify_admins_trigger
AFTER INSERT ON public.staking_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_staking_order();


-- ── 5. Trigger: Custom Property Requests ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_custom_property_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  u_name := NEW.user_name;
  u_email := NEW.user_email;

  IF u_name IS NULL OR u_email IS NULL THEN
    SELECT name, email INTO u_name, u_email
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Property Request] ' || user_display;
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') submitted custom ' ||
            COALESCE(NEW.category, 'Property') || ' acquisition at ' ||
            COALESCE(NULLIF(NEW.location, ''), 'Unspecified Location') ||
            ' (Total: $' || to_char(NEW.total_price, 'FM999,999,990.00') ||
            ', Deposit: $' || to_char(NEW.upfront_deposit, 'FM999,999,990.00') || ').';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/properties', 'admin-property-request');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_property_requests_notify_admins_trigger ON public.custom_property_requests;
CREATE TRIGGER custom_property_requests_notify_admins_trigger
AFTER INSERT ON public.custom_property_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_custom_property_request();


-- ── 6. Trigger: Property Investments (Deeds) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_property_investment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  prop_title TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT name, email INTO u_name, u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  SELECT title INTO prop_title
  FROM public.properties
  WHERE id = NEW.property_id;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Property Deed] ' || user_display || ' ($' || to_char(NEW.amount_paid, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') invested $' ||
            to_char(NEW.amount_paid, 'FM999,999,990.00') || ' in deed: ' ||
            COALESCE(prop_title, 'Property Listing') ||
            ' (' || COALESCE(NEW.term_months::text, '12') || ' Months).';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/properties', 'admin-property-invest');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_investments_notify_admins_trigger ON public.property_investments;
CREATE TRIGGER property_investments_notify_admins_trigger
AFTER INSERT ON public.property_investments
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_property_investment();


-- ── 7. Trigger: Investment Orders (Plans) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT name, email INTO u_name, u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[Investment Plan] ' || user_display || ' ($' || to_char(NEW.amount, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') created an investment of $' ||
            to_char(NEW.amount, 'FM999,999,990.00') || ' in ' ||
            COALESCE(NULLIF(NEW.product_name, ''), 'Investment Plan') ||
            ' (' || COALESCE(NEW.daily_return::text, '0') || '%/day).';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/orders', 'admin-order');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_admins_trigger ON public.orders;
CREATE TRIGGER orders_notify_admins_trigger
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_order();


-- ── 8. Trigger: P2P Escrow Orders ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_p2p_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  u_name := NEW.user_name;
  u_email := NEW.user_email;

  IF u_name IS NULL OR u_email IS NULL THEN
    SELECT name, email INTO u_name, u_email
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  p_title := '[P2P Escrow] ' || user_display || ' ($' || to_char(NEW.amount_usd, 'FM999,999,990.00') || ')';
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') locked $' ||
            to_char(NEW.amount_usd, 'FM999,999,990.00') || ' USD in P2P escrow for ' ||
            COALESCE(NEW.target_amount::text, '0') || ' ' ||
            COALESCE(NEW.target_currency_symbol, '') ||
            ' (Merchant: ' || COALESCE(NEW.merchant_name, 'Merchant') || ').';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/p2p', 'admin-p2p');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS p2p_orders_notify_admins_trigger ON public.p2p_orders;
CREATE TRIGGER p2p_orders_notify_admins_trigger
AFTER INSERT ON public.p2p_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_p2p_order();


-- ── 9. Trigger: KYC Verifications ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_kyc_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_email TEXT;
  user_display TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  SELECT email INTO u_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  user_display := COALESCE(NULLIF(trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''), u_email, 'Investor');
  p_title := '[KYC Submitted] ' || user_display;
  p_body := user_display || ' (' || COALESCE(u_email, 'N/A') || ') submitted ' ||
            upper(COALESCE(NEW.document_type, 'ID')) || ' (' ||
            COALESCE(NEW.document_number, 'N/A') || ') from ' ||
            COALESCE(NEW.country, 'N/A') || ' for identity verification.';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/kyc', 'admin-kyc');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_verifications_notify_admins_trigger ON public.kyc_verifications;
CREATE TRIGGER kyc_verifications_notify_admins_trigger
AFTER INSERT ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_kyc_verification();


-- ── 10. Trigger: Support Chat Messages (Inbound User Messages) ─────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_name TEXT;
  u_email TEXT;
  sender_is_admin BOOLEAN;
  user_display TEXT;
  msg_preview TEXT;
  p_title TEXT;
  p_body TEXT;
BEGIN
  -- Only trigger for user messages sent to support (user_id = sender_id)
  IF NEW.user_id <> NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Verify sender is not an admin
  SELECT is_admin, name, email INTO sender_is_admin, u_name, u_email
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF sender_is_admin = true THEN
    RETURN NEW;
  END IF;

  user_display := COALESCE(NULLIF(u_name, ''), u_email, 'Investor');
  msg_preview := substring(NEW.body from 1 for 75);
  IF length(NEW.body) > 75 THEN
    msg_preview := msg_preview || '...';
  END IF;

  p_title := '[Support Chat] ' || user_display;
  p_body := user_display || ': "' || msg_preview || '"';

  PERFORM public.dispatch_admin_push(p_title, p_body, '/admin/chat', 'admin-support-chat');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_admins_support_trigger ON public.messages;
CREATE TRIGGER messages_notify_admins_support_trigger
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_support_message();


-- ── 11. Global Performance Composite Indexes ──────────────────────────────────
-- These composite indexes eliminate table sequential scans across high-frequency
-- badge checks, real-time unread queries, and dashboard loading.

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_read 
  ON public.messages(user_id, read);

CREATE INDEX IF NOT EXISTS idx_messages_sender_read 
  ON public.messages(sender_id, read);

CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_read 
  ON public.direct_messages(receiver_id, read);

CREATE INDEX IF NOT EXISTS idx_deposits_user_created 
  ON public.deposits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created 
  ON public.withdrawals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staking_orders_user_created 
  ON public.staking_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_user_created 
  ON public.p2p_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created 
  ON public.orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_investments_user_created 
  ON public.property_investments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_property_requests_user_created 
  ON public.custom_property_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_status 
  ON public.kyc_verifications(user_id, status);
