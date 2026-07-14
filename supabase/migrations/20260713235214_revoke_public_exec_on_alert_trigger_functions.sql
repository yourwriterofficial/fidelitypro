-- These are trigger functions (return TRIGGER, reference NEW/OLD) — they
-- cannot be meaningfully invoked outside trigger context, but PostgREST
-- still auto-exposes any SECURITY DEFINER function in `public` as an RPC
-- endpoint by default. Revoke that so they're only ever run by the triggers
-- themselves, not directly callable via /rest/v1/rpc/...
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_investor_chat_post() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_watched_user_online() FROM PUBLIC, anon, authenticated;
