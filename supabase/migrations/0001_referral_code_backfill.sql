-- Referral permalink fix
-- ------------------------------------------------------------------
-- Symptom: referral links rendered as ".../signup?ref=null" for any
-- profile whose referral_code was never set (older accounts, or rows
-- created before the signup edge function started generating one). A
-- null code also breaks the signup lookup, so the link did not work.
--
-- Run this once in the Supabase SQL editor for project
-- eofbdmhjirbtidtucqkp.

-- 1. Backfill a unique, stable code for every profile missing one.
update public.profiles
set    referral_code = substr(md5(random()::text || id::text), 1, 8)
where  referral_code is null
   or  referral_code = ''
   or  referral_code = 'null';

-- 2. Guarantee future rows always get a code, even if an insert path
--    forgets to set it (defence in depth alongside the edge functions).
alter table public.profiles
  alter column referral_code set default substr(md5(random()::text), 1, 8);

-- 3. Enforce uniqueness so links can never collide.
create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);
