-- Add live translator entitlement and browser language fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_translate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS browser_language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS preferred_translation_lang text DEFAULT 'es';

-- Index for quick lookup on admin users filter
CREATE INDEX IF NOT EXISTS idx_profiles_can_translate ON public.profiles(can_translate);
