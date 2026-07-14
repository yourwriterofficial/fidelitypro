create policy "Users can insert own notifications" on public.notifications for insert to public with check (user_id = auth.uid());
