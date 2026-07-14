create table public.admin_watched_users (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(admin_id, target_user_id)
);

alter table public.admin_watched_users enable row level security;

create policy "Select watches" on public.admin_watched_users
  for select using (auth.uid() = admin_id);

create policy "Insert watches" on public.admin_watched_users
  for insert with check (
    auth.uid() = admin_id
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );

create policy "Delete watches" on public.admin_watched_users
  for delete using (auth.uid() = admin_id);
