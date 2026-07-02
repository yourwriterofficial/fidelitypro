-- Add a free-form category to listings so admins can post houses, cars, land, or anything.
-- Existing rows default to 'Property' so nothing breaks.
alter table public.properties
  add column if not exists category text not null default 'Property';

-- Optional: index if you later filter/sort by category on large datasets.
create index if not exists properties_category_idx on public.properties (category);
