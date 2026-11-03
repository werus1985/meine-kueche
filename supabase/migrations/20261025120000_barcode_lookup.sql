-- ============================================================================
-- Barcode-Lookup: externe Produktdaten (Open Food Facts)
-- ============================================================================
-- * households.external_lookup_enabled: Haushalts-Schalter, ob beim Anlegen
--   unbekannter Barcodes eine externe Produktdatenbank gefragt werden darf.
-- * external_product_mappings: gelernte Zuordnungen externer Kategorie-Tags
--   zu den Kategorien/Einheiten des Haushalts. Lokales Wissen gewinnt immer;
--   die Tabelle wächst mit jeder Korrektur und macht den Lookup zunehmend
--   überflüssig.
-- ============================================================================

alter table public.households
  add column if not exists external_lookup_enabled boolean not null default true;

create table if not exists public.external_product_mappings (
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null default 'openfoodfacts',
  tag          text not null check (length(btrim(tag)) between 1 and 200),
  category_id  uuid references public.kitchen_categories(id) on delete set null,
  unit_id      uuid references public.kitchen_units(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, source, tag)
);

create index if not exists external_product_mappings_household_idx
  on public.external_product_mappings (household_id);

alter table public.external_product_mappings enable row level security;

create policy external_product_mappings_select on public.external_product_mappings
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy external_product_mappings_insert on public.external_product_mappings
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy external_product_mappings_update on public.external_product_mappings
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy external_product_mappings_delete on public.external_product_mappings
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

grant select, insert, update, delete
  on public.external_product_mappings to authenticated;
