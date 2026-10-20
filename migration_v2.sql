-- Meine Küche – Ergänzung für Notizen und haushaltsspezifische Lagerorte
-- Diese Ergänzung ausführen; migration_haushalte.sql NICHT erneut ausführen.
alter table public.kitchen_items add column if not exists notes text not null default '';

create table if not exists public.kitchen_household_locations (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  household_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, household_id, name)
);
alter table public.kitchen_household_locations enable row level security;
drop policy if exists "Users can manage own household locations" on public.kitchen_household_locations;
create policy "Users can manage own household locations" on public.kitchen_household_locations
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- RLS-Policies für kitchen_units wurden bereits in migration_haushalte.sql angelegt.
