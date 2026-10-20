-- Kategorieeinstellungen pro Benutzer (gelten für alle Haushalte des Kontos).
-- Bestehende Tabelle wird ergänzt, nicht gelöscht.
alter table public.kitchen_category_settings
  add column if not exists category_name text,
  add column if not exists category text,
  add column if not exists warning_days integer,
  add column if not exists yellow_days integer,
  add column if not exists warning_basis text not null default 'expiry',
  add column if not exists default_sort text not null default 'auto',
  add column if not exists updated_at timestamptz not null default now();

-- Bestehende Werte zwischen den älteren und neueren Spalten abgleichen.
update public.kitchen_category_settings
set category_name = coalesce(category_name, category),
    category = coalesce(category, category_name),
    yellow_days = coalesce(yellow_days, warning_days, 2),
    warning_days = coalesce(warning_days, yellow_days, 2),
    warning_basis = coalesce(warning_basis, 'expiry'),
    default_sort = coalesce(default_sort, 'auto')
where category_name is null or category is null
   or yellow_days is null or warning_days is null or warning_basis is null
   or default_sort is null;

-- App verwendet die natürliche Kombination als Schlüssel; ID bleibt bigint identity.
create unique index if not exists kitchen_category_settings_owner_category_name_uidx
  on public.kitchen_category_settings(owner_id, category_name);

alter table public.kitchen_category_settings enable row level security;
drop policy if exists "Users can read own category settings" on public.kitchen_category_settings;
drop policy if exists "Users can insert own category settings" on public.kitchen_category_settings;
drop policy if exists "Users can update own category settings" on public.kitchen_category_settings;
drop policy if exists "Users can delete own category settings" on public.kitchen_category_settings;
drop policy if exists "Users manage own kitchen category settings" on public.kitchen_category_settings;
create policy "Users manage own kitchen category settings"
  on public.kitchen_category_settings for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.kitchen_category_settings to authenticated;
notify pgrst, 'reload schema';
