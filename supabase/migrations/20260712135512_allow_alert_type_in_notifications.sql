alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['info'::text, 'success'::text, 'warning'::text, 'error'::text, 'alert'::text]));
