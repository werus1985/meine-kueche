-- Zusätzliche Migration für Haushalte (nicht das alte supabase.sql erneut ausführen)
-- Vorhandene Datensätze bleiben erhalten.
alter table public.kitchen_items add column if not exists household_id text;

create table if not exists public.kitchen_households (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table public.kitchen_households enable row level security;
drop policy if exists "Users can read own kitchen households" on public.kitchen_households;
drop policy if exists "Users can insert own kitchen households" on public.kitchen_households;
drop policy if exists "Users can update own kitchen households" on public.kitchen_households;
drop policy if exists "Users can delete own kitchen households" on public.kitchen_households;
create policy "Users can read own kitchen households" on public.kitchen_households for select to authenticated using (auth.uid() = owner_id);
create policy "Users can insert own kitchen households" on public.kitchen_households for insert to authenticated with check (auth.uid() = owner_id);
create policy "Users can update own kitchen households" on public.kitchen_households for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users can delete own kitchen households" on public.kitchen_households for delete to authenticated using (auth.uid() = owner_id);

-- Global Mengeneinheiten: gemeinsame Tabelle für alle Haushalte eines Kontos.
create table if not exists public.kitchen_units (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);
alter table public.kitchen_units enable row level security;
drop policy if exists "Users can manage own kitchen units" on public.kitchen_units;
create policy "Users can manage own kitchen units" on public.kitchen_units for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
