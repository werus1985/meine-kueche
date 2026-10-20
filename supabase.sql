-- In deinem Supabase-Projekt unter SQL Editor ausführen.
-- Jeder Nutzer sieht nur die eigenen Datensätze. Auf weiteren Handys mit demselben Konto anmelden.
create table if not exists public.kitchen_items (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('stock','shop')),
  name text not null,
  qty text,
  unit text,
  location text,
  expiry date,
  checked boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.kitchen_items enable row level security;
create policy "Users can read own kitchen items" on public.kitchen_items
  for select to authenticated using (auth.uid() = owner_id);
create policy "Users can insert own kitchen items" on public.kitchen_items
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Users can update own kitchen items" on public.kitchen_items
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users can delete own kitchen items" on public.kitchen_items
  for delete to authenticated using (auth.uid() = owner_id);
