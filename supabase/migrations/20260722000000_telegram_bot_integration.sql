-- Migration: Telegram Bot Integration
-- Adds telegram_id and telegram_username columns to profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS telegram_id bigint UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username text;

-- Create index on telegram_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);

-- Helper function to link Telegram ID to user profile safely
CREATE OR REPLACE FUNCTION public.link_telegram_account(
  p_user_id uuid,
  p_telegram_id bigint,
  p_telegram_username text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    telegram_id = p_telegram_id,
    telegram_username = COALESCE(p_telegram_username, telegram_username)
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;
