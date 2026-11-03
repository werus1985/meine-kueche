-- ============================================================================
-- Zielschema: Mehrbenutzerfähige Küchenverwaltung
-- ============================================================================
-- VORSICHT: Dieses Skript legt ein NEUES Schema an. Es ist für eine frische
-- Datenbank bzw. eine kontrollierte Migration gedacht, nicht zum blinden
-- Ausführen auf der bestehenden Produktionsdatenbank.
--
-- Die bestehenden Tabellen heißen teilweise genauso. Auf der aktuellen
-- Datenbank würde das Skript deshalb abbrechen. Für die Migration siehe
-- docs/datenbank-multiuser.md, Abschnitt 5.
--
-- Grundprinzip:
--   * Haushaltsdaten hängen über household_id an genau einem Haushalt.
--   * Zugriff über household_members + household_roles.
--   * Kein owner_id in Fachtabellen; created_by/updated_by nur als Audit.
--   * Benutzerspezifische Daten nutzen user_id.
-- ============================================================================

begin;

-- pgcrypto wird für Token-Hashes und Zufallstoken benötigt.
-- In Supabase liegt es im Schema `extensions`.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Profile
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Rollen und Rechte
-- ----------------------------------------------------------------------------
create table public.household_roles (
  key                  text primary key,
  name                 text not null,
  can_read             boolean not null default true,
  can_write            boolean not null default false,
  can_manage_members   boolean not null default false,
  can_manage_household boolean not null default false
);

insert into public.household_roles
  (key, name, can_read, can_write, can_manage_members, can_manage_household)
values
  ('owner',  'Eigentümer',  true, true,  true,  true),
  ('editor', 'Bearbeiter',  true, true,  false, false),
  ('viewer', 'Nur Lesen',   true, false, false, false)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Haushalte und Mitgliedschaften
-- ----------------------------------------------------------------------------
create table public.households (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) between 1 and 80),
  external_lookup_enabled boolean not null default true,
  created_by              uuid default auth.uid() references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'viewer' references public.household_roles(key),
  joined_at    timestamptz not null default now(),
  invited_by   uuid references auth.users(id) on delete set null,
  primary key (household_id, user_id)
);

create index household_members_user_idx
  on public.household_members (user_id);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email        text not null,
  role         text not null default 'viewer' references public.household_roles(key),
  token_hash   text not null unique,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index household_invites_household_idx
  on public.household_invites (household_id);
create index household_invites_email_idx
  on public.household_invites (lower(email));

-- ----------------------------------------------------------------------------
-- 4. Stammdaten pro Haushalt
-- ----------------------------------------------------------------------------
create table public.kitchen_categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_categories_household_name_uidx
  on public.kitchen_categories (household_id, lower(btrim(name)));

create table public.kitchen_locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_locations_household_name_uidx
  on public.kitchen_locations (household_id, lower(btrim(name)));

create table public.kitchen_units (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 40),
  step_size    numeric not null default 1 check (step_size > 0),
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_units_household_name_uidx
  on public.kitchen_units (household_id, lower(btrim(name)));

-- Ein Produkt speichert wiederverwendbares Wissen (Barcode, Name, Kategorie,
-- Einheit und Foto). Es bleibt bestehen, auch wenn gerade keine aktiven Artikel
-- dieser Gruppe im Vorrat liegen.
create table public.kitchen_products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  barcode      text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name         text not null check (length(btrim(name)) between 1 and 200),
  category_id  uuid references public.kitchen_categories(id) on delete set null,
  unit_id      uuid references public.kitchen_units(id) on delete set null,
  last_location_id uuid references public.kitchen_locations(id) on delete set null,
  photo_path   text,
  seasonal     boolean not null default false,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_products_household_barcode_uidx
  on public.kitchen_products (household_id, barcode)
  where barcode is not null;
create index kitchen_products_household_name_idx
  on public.kitchen_products (household_id, lower(name));
create index kitchen_products_last_location_idx
  on public.kitchen_products (household_id, last_location_id)
  where last_location_id is not null;

-- ----------------------------------------------------------------------------
-- 5. Artikel
-- ----------------------------------------------------------------------------
create table public.kitchen_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id   uuid references public.kitchen_products(id) on delete set null,
  kind         text not null check (kind in ('stock', 'shop')),
  name         text not null check (length(btrim(name)) between 1 and 200),
  barcode      text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  qty          numeric check (qty is null or qty >= 0),
  unit_id      uuid references public.kitchen_units(id) on delete set null,
  location_id  uuid references public.kitchen_locations(id) on delete set null,
  category_id  uuid references public.kitchen_categories(id) on delete set null,
  expiry       date,
  purchased_at date,
  checked      boolean not null default false,
  notes        text not null default '',
  photo_path   text,
  deleted_at   timestamptz,
  version      integer not null default 1,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index kitchen_items_household_kind_idx
  on public.kitchen_items (household_id, kind) where deleted_at is null;
create index kitchen_items_household_expiry_idx
  on public.kitchen_items (household_id, expiry) where kind = 'stock' and deleted_at is null;
create index kitchen_items_household_updated_idx
  on public.kitchen_items (household_id, updated_at);
create index kitchen_items_household_barcode_idx
  on public.kitchen_items (household_id, barcode)
  where barcode is not null and deleted_at is null;
create index kitchen_items_product_idx
  on public.kitchen_items (household_id, product_id, kind)
  where product_id is not null and deleted_at is null;
create index kitchen_items_photo_path_idx
  on public.kitchen_items (photo_path) where photo_path is not null;

-- ----------------------------------------------------------------------------
-- 6. Kategorie-Einstellungen und Schnellfilter
-- ----------------------------------------------------------------------------
create table public.kitchen_category_settings (
  household_id  uuid not null,
  category_id   uuid not null,
  warning_days  integer not null default 2 check (warning_days >= 0),
  warning_basis text not null default 'expiry'
    check (warning_basis in ('expiry', 'purchase')),
  default_sort  text not null default 'auto'
    check (default_sort in ('auto', 'expiry', 'purchase', 'name')),
  updated_at    timestamptz not null default now(),
  primary key (household_id, category_id),
  foreign key (household_id, category_id)
    references public.kitchen_categories (household_id, id) on delete cascade
);

create table public.kitchen_quick_filters (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_quick_filters_household_name_uidx
  on public.kitchen_quick_filters (household_id, lower(btrim(name)));

create table public.kitchen_quick_filter_categories (
  household_id uuid not null,
  filter_id    uuid not null,
  category_id  uuid not null,
  primary key (filter_id, category_id),
  foreign key (household_id, filter_id)
    references public.kitchen_quick_filters (household_id, id) on delete cascade,
  foreign key (household_id, category_id)
    references public.kitchen_categories (household_id, id) on delete cascade
);

-- Gelernte Zuordnungen externer Produkt-Tags (z. B. Open Food Facts) zu
-- Kategorien/Einheiten des Haushalts. Lokales Wissen gewinnt immer; die
-- Tabelle wächst mit jeder Korrektur und macht den Barcode-Lookup zunehmend
-- überflüssig.
create table public.external_product_mappings (
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null default 'openfoodfacts',
  tag          text not null check (length(btrim(tag)) between 1 and 200),
  category_id  uuid references public.kitchen_categories(id) on delete set null,
  unit_id      uuid references public.kitchen_units(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, source, tag)
);

create index external_product_mappings_household_idx
  on public.external_product_mappings (household_id);

-- Optionale persönliche Darstellung der haushaltsweiten Filter.
-- Die Filter selbst bleiben geteilt; hier wird nur Reihenfolge/Sichtbarkeit
-- pro Benutzer gespeichert.
-- create table public.kitchen_quick_filter_preferences (
--   user_id    uuid not null references auth.users(id) on delete cascade,
--   filter_id  uuid not null references public.kitchen_quick_filters(id) on delete cascade,
--   sort_order integer,
--   hidden     boolean not null default false,
--   primary key (user_id, filter_id)
-- );

-- Optionale persönliche Schrittgrößen. Standard ist step_size in kitchen_units.
-- create table public.kitchen_unit_preferences (
--   user_id    uuid not null references auth.users(id) on delete cascade,
--   unit_id    uuid not null references public.kitchen_units(id) on delete cascade,
--   step_size  numeric not null check (step_size > 0),
--   updated_at timestamptz not null default now(),
--   primary key (user_id, unit_id)
-- );

-- ----------------------------------------------------------------------------
-- 7. Hilfsfunktionen für RLS
-- ----------------------------------------------------------------------------
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_household_permission(
  p_household_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case p_permission
      when 'read'              then r.can_read
      when 'write'             then r.can_write
      when 'manage_members'    then r.can_manage_members
      when 'manage_household'  then r.can_manage_household
      else false
    end
    from public.household_members m
    join public.household_roles r on r.key = m.role
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  ), false);
$$;

create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members other
      on other.household_id = me.household_id
    where me.user_id = auth.uid()
      and other.user_id = p_user_id
  );
$$;

-- Extrahiert die Haushalts-ID aus einem Storage-Pfad wie
--   {household_id}/{item_id}/{datei}.jpg
-- und gibt bei ungültigen Pfaden NULL zurück (kein Cast-Fehler).
create or replace function public.storage_household_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Trigger-Funktionen
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_item_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.version := 1;
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_product_household_refs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.kitchen_categories
    where id = new.category_id and household_id = new.household_id
  ) then
    raise exception 'Produktkategorie gehört nicht zum Haushalt';
  end if;

  if new.unit_id is not null and not exists (
    select 1 from public.kitchen_units
    where id = new.unit_id and household_id = new.household_id
  ) then
    raise exception 'Produkteinheit gehört nicht zum Haushalt';
  end if;

  if new.last_location_id is not null and not exists (
    select 1 from public.kitchen_locations
    where id = new.last_location_id and household_id = new.household_id
  ) then
    raise exception 'Produktlagerort gehört nicht zum Haushalt';
  end if;

  return new;
end;
$$;

-- Die Artikeltabelle hält die gemeinsamen Produktattribute denormalisiert,
-- damit bestehende Suchen/Joins schnell bleiben. Die Produktzeile ist führend.
create or replace function public.sync_product_fields_on_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.kitchen_products;
begin
  if new.product_id is null then
    return new;
  end if;

  select * into p
  from public.kitchen_products
  where id = new.product_id
    and household_id = new.household_id;

  if not found then
    raise exception 'Produktgruppe gehört nicht zum Haushalt oder existiert nicht';
  end if;

  new.name := p.name;
  new.barcode := p.barcode;
  new.category_id := p.category_id;
  new.unit_id := p.unit_id;
  new.photo_path := p.photo_path;
  return new;
end;
$$;

create or replace function public.propagate_product_fields_to_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.kitchen_items
  set name = new.name,
      barcode = new.barcode,
      category_id = new.category_id,
      unit_id = new.unit_id,
      photo_path = new.photo_path
  where household_id = new.household_id
    and product_id = new.id
    and (name, barcode, category_id, unit_id, photo_path)
        is distinct from
        (new.name, new.barcode, new.category_id, new.unit_id, new.photo_path);
  return new;
end;
$$;

create or replace function public.remember_product_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null
     and new.kind = 'stock'
     and new.deleted_at is null
     and new.location_id is not null
     and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    update public.kitchen_products
    set last_location_id = new.location_id
    where id = new.product_id
      and household_id = new.household_id;
  end if;
  return new;
end;
$$;

-- Stellt sicher, dass Kategorie, Lagerort und Einheit zum selben Haushalt
-- gehören. Das verhindert Cross-Household-Referenzen trotz Foreign Key.
create or replace function public.validate_item_household_refs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.kitchen_categories
    where id = new.category_id and household_id = new.household_id
  ) then
    raise exception 'Kategorie gehört nicht zum Haushalt';
  end if;

  if new.location_id is not null and not exists (
    select 1 from public.kitchen_locations
    where id = new.location_id and household_id = new.household_id
  ) then
    raise exception 'Lagerort gehört nicht zum Haushalt';
  end if;

  if new.unit_id is not null and not exists (
    select 1 from public.kitchen_units
    where id = new.unit_id and household_id = new.household_id
  ) then
    raise exception 'Einheit gehört nicht zum Haushalt';
  end if;

  if new.product_id is not null and not exists (
    select 1 from public.kitchen_products
    where id = new.product_id and household_id = new.household_id
  ) then
    raise exception 'Produktgruppe gehört nicht zum Haushalt';
  end if;

  return new;
end;
$$;

-- Der letzte Owner eines Haushalts darf nicht entfernt oder herabgestuft werden.
-- Bei Kaskadenlöschungen (Haushalt oder Benutzer) wird die Prüfung übersprungen.
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Kaskadenlöschungen (Haushalt, auth.users) und administrative Eingriffe
  -- ohne JWT dürfen die Owner-Prüfung passieren.
  if pg_trigger_depth() > 1 or auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not exists (
      select 1 from public.households where id = old.household_id
    ) then
      return old;
    end if;

    if old.role = 'owner' and not exists (
      select 1
      from public.household_members
      where household_id = old.household_id
        and role = 'owner'
        and user_id <> old.user_id
    ) then
      raise exception 'Der letzte Eigentümer kann nicht entfernt werden.';
    end if;
    return old;
  end if;

  if old.role = 'owner' and new.role <> 'owner' and not exists (
    select 1
    from public.household_members
    where household_id = old.household_id
      and role = 'owner'
      and user_id <> old.user_id
  ) then
    raise exception 'Der letzte Eigentümer kann nicht herabgestuft werden.';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Trigger anlegen
-- ----------------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_members_protect_last_owner
  before update or delete on public.household_members
  for each row execute function public.protect_last_owner();

create trigger kitchen_categories_set_updated_at
  before update on public.kitchen_categories
  for each row execute function public.set_updated_at();

create trigger kitchen_locations_set_updated_at
  before update on public.kitchen_locations
  for each row execute function public.set_updated_at();

create trigger kitchen_units_set_updated_at
  before update on public.kitchen_units
  for each row execute function public.set_updated_at();

create trigger kitchen_products_set_updated_at
  before update on public.kitchen_products
  for each row execute function public.set_updated_at();

create trigger kitchen_products_validate_refs
  before insert or update on public.kitchen_products
  for each row execute function public.validate_product_household_refs();

create trigger kitchen_products_propagate_fields
  after update of name, barcode, category_id, unit_id, photo_path
  on public.kitchen_products
  for each row execute function public.propagate_product_fields_to_items();

create trigger kitchen_items_set_metadata
  before insert or update on public.kitchen_items
  for each row execute function public.set_item_metadata();

create trigger kitchen_items_sync_product_fields
  before insert or update on public.kitchen_items
  for each row execute function public.sync_product_fields_on_item();

create trigger kitchen_items_validate_refs
  before insert or update on public.kitchen_items
  for each row execute function public.validate_item_household_refs();

create trigger kitchen_items_remember_product_location
  after insert or update of product_id, kind, location_id, deleted_at
  on public.kitchen_items
  for each row execute function public.remember_product_location();

create trigger kitchen_category_settings_set_updated_at
  before update on public.kitchen_category_settings
  for each row execute function public.set_updated_at();

create trigger kitchen_quick_filters_set_updated_at
  before update on public.kitchen_quick_filters
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.household_roles          enable row level security;
alter table public.households               enable row level security;
alter table public.household_members        enable row level security;
alter table public.household_invites        enable row level security;
alter table public.kitchen_categories       enable row level security;
alter table public.kitchen_locations        enable row level security;
alter table public.kitchen_units            enable row level security;
alter table public.kitchen_products         enable row level security;
alter table public.kitchen_items            enable row level security;
alter table public.kitchen_category_settings enable row level security;
alter table public.kitchen_quick_filters            enable row level security;
alter table public.kitchen_quick_filter_categories  enable row level security;
alter table public.external_product_mappings         enable row level security;

-- Profile: eigenes Profil und Profile von Haushaltsmitgliedern lesen.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_household_with(id)
  );

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rollen sind ein globaler, schreibgeschützter Katalog.
create policy household_roles_read on public.household_roles
  for select to authenticated
  using (true);

-- Haushalte: lesbar für Mitglieder, verwaltbar nur mit Recht.
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy households_update on public.households
  for update to authenticated
  using (public.has_household_permission(id, 'manage_household'))
  with check (public.has_household_permission(id, 'manage_household'));

create policy households_delete on public.households
  for delete to authenticated
  using (public.has_household_permission(id, 'manage_household'));

-- Mitglieder: alle Mitglieder dürfen die Mitgliederliste sehen.
-- Schreiben ausschließlich über die RPCs weiter unten.
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- Einladungen: Manager oder die eingeladene E-Mail-Adresse.
create policy household_invites_select on public.household_invites
  for select to authenticated
  using (
    public.has_household_permission(household_id, 'manage_members')
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Fachtabellen: Lesen für Mitglieder, Schreiben für can_write.
create policy kitchen_categories_select on public.kitchen_categories
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_categories_insert on public.kitchen_categories
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_categories_update on public.kitchen_categories
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_categories_delete on public.kitchen_categories
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_locations_select on public.kitchen_locations
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_locations_insert on public.kitchen_locations
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_locations_update on public.kitchen_locations
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_locations_delete on public.kitchen_locations
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_units_select on public.kitchen_units
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_units_insert on public.kitchen_units
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_units_update on public.kitchen_units
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_units_delete on public.kitchen_units
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_products_select on public.kitchen_products
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_products_insert on public.kitchen_products
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_products_update on public.kitchen_products
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));

create policy kitchen_items_select on public.kitchen_items
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_items_insert on public.kitchen_items
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_items_update on public.kitchen_items
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_items_delete on public.kitchen_items
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_category_settings_select on public.kitchen_category_settings
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_category_settings_insert on public.kitchen_category_settings
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_category_settings_update on public.kitchen_category_settings
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_category_settings_delete on public.kitchen_category_settings
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

-- Schnellfilter gehören zum Haushalt: alle Mitglieder lesen, can_write ändert.
create policy kitchen_quick_filters_select on public.kitchen_quick_filters
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_quick_filters_insert on public.kitchen_quick_filters
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_quick_filters_update on public.kitchen_quick_filters
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_quick_filters_delete on public.kitchen_quick_filters
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_quick_filter_categories_select on public.kitchen_quick_filter_categories
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_quick_filter_categories_insert on public.kitchen_quick_filter_categories
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_quick_filter_categories_update on public.kitchen_quick_filter_categories
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_quick_filter_categories_delete on public.kitchen_quick_filter_categories
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

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

-- ----------------------------------------------------------------------------
-- 11. RPCs für konsistente Mehrtabellen-Operationen
-- ----------------------------------------------------------------------------

-- Haushalt + Owner-Mitgliedschaft + Standarddaten atomar anlegen.
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h public.households;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'Der Haushaltsname muss 1 bis 80 Zeichen lang sein.';
  end if;

  insert into public.households (name)
  values (v_name)
  returning * into h;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'owner');

  insert into public.kitchen_categories (household_id, name)
  values (h.id, 'Allgemein');

  insert into public.kitchen_locations (household_id, name, sort_order)
  values
    (h.id, 'Vorratsschrank', 10),
    (h.id, 'Kühlschrank',    20),
    (h.id, 'Gefrierfach',    30),
    (h.id, 'Gewürzregal',    40),
    (h.id, 'Sonstiges',      50);

  insert into public.kitchen_units (household_id, name, step_size, sort_order)
  values
    (h.id, 'Stück',   1,    10),
    (h.id, 'Packung', 1,    20),
    (h.id, 'g',       100,  30),
    (h.id, 'kg',      0.5,  40),
    (h.id, 'ml',      50,   50),
    (h.id, 'Liter',   0.25, 60),
    (h.id, 'Dose',    1,    70),
    (h.id, 'Flasche', 1,    80);

  insert into public.kitchen_category_settings (household_id, category_id)
  select h.id, c.id
  from public.kitchen_categories c
  where c.household_id = h.id;

  return h;
end;
$$;

-- Mitglieder werden ausschließlich per Einladung hinzugefügt.
-- Siehe create_household_invite / accept_household_invite.

create or replace function public.set_member_role(
  p_household_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_household_permission(p_household_id, 'manage_members') then
    raise exception 'Keine Berechtigung, Rollen zu ändern.';
  end if;
  if p_role = 'owner'
     and not public.has_household_permission(p_household_id, 'manage_household') then
    raise exception 'Nur Eigentümer können Eigentümer ernennen.';
  end if;

  update public.household_members
  set role = p_role
  where household_id = p_household_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Mitglied nicht gefunden.';
  end if;
end;
$$;

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() <> p_user_id
     and not public.has_household_permission(p_household_id, 'manage_members') then
    raise exception 'Keine Berechtigung, Mitglieder zu entfernen.';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Mitglied nicht gefunden.';
  end if;
end;
$$;

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_email text,
  p_role text default 'viewer'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if not public.has_household_permission(p_household_id, 'manage_members') then
    raise exception 'Keine Berechtigung, Einladungen zu erstellen.';
  end if;
  if p_role = 'owner'
     and not public.has_household_permission(p_household_id, 'manage_household') then
    raise exception 'Nur Eigentümer können Eigentümer ernennen.';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.household_invites
    (household_id, email, role, token_hash, invited_by)
  values
    (p_household_id, btrim(p_email), p_role,
     encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());

  return v_token;
end;
$$;

create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.household_invites;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select *
  into v_invite
  from public.household_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Einladung ist ungültig oder abgelaufen.';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'Die Einladung gilt für eine andere E-Mail-Adresse.';
  end if;

  insert into public.household_members (household_id, user_id, role, invited_by)
  values (v_invite.household_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_household_permission(p_household_id, 'manage_household') then
    raise exception 'Keine Berechtigung, den Haushalt zu löschen.';
  end if;

  delete from public.households where id = p_household_id;

  if not found then
    raise exception 'Haushalt nicht gefunden.';
  end if;
end;
$$;

-- Mitgliederliste inkl. Profilname. E-Mail-Adressen werden nur an Personen
-- mit manage_members-Recht ausgeliefert.
create or replace function public.get_household_members(p_household_id uuid)
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  role         text,
  joined_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Kein Zugriff auf diesen Haushalt.';
  end if;

  return query
  select
    m.user_id,
    p.display_name,
    case
      when public.has_household_permission(p_household_id, 'manage_members')
      then u.email::text
      else null
    end,
    m.role,
    m.joined_at
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.household_id = p_household_id
  order by m.joined_at;
end;
$$;

-- Einladung anhand des Tokens laden (für die Annahme-Seite).
-- Funktioniert nur für die eingeladene E-Mail-Adresse.
create or replace function public.get_household_invite(p_token text)
returns table (
  household_id   uuid,
  household_name text,
  email          text,
  role           text,
  expires_at     timestamptz,
  accepted_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  return query
  select i.household_id, h.name, i.email, i.role, i.expires_at, i.accepted_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and lower(i.email) = v_email;
end;
$$;

-- Offene Einladung zurückziehen.
create or replace function public.revoke_household_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
  from public.household_invites
  where id = p_invite_id;

  if v_household is null then
    raise exception 'Einladung nicht gefunden.';
  end if;

  if not public.has_household_permission(v_household, 'manage_members') then
    raise exception 'Keine Berechtigung, Einladungen zu verwalten.';
  end if;

  delete from public.household_invites
  where id = p_invite_id
    and accepted_at is null;

  if not found then
    raise exception 'Einladung wurde bereits angenommen oder existiert nicht.';
  end if;
end;
$$;

-- Kategorie löschen und alle Artikel auf „Allgemein“ verschieben.
create or replace function public.delete_category(
  p_household_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name     text;
  v_fallback uuid;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Kategorien zu löschen.';
  end if;

  select name into v_name
  from public.kitchen_categories
  where id = p_category_id and household_id = p_household_id;

  if v_name is null then
    raise exception 'Kategorie nicht gefunden.';
  end if;
  if lower(btrim(v_name)) = 'allgemein' then
    raise exception 'Die Kategorie „Allgemein“ kann nicht gelöscht werden.';
  end if;

  select id into v_fallback
  from public.kitchen_categories
  where household_id = p_household_id
    and lower(btrim(name)) = 'allgemein';

  if v_fallback is null then
    insert into public.kitchen_categories (household_id, name)
    values (p_household_id, 'Allgemein')
    returning id into v_fallback;

    insert into public.kitchen_category_settings (household_id, category_id)
    values (p_household_id, v_fallback)
    on conflict do nothing;
  end if;

  update public.kitchen_products
  set category_id = v_fallback
  where household_id = p_household_id
    and category_id = p_category_id;

  -- Produkt-Trigger verteilen die neue Kategorie an verknüpfte Artikel;
  -- hier bleiben nur Artikel ohne Produktgruppe übrig.
  update public.kitchen_items
  set category_id = v_fallback
  where household_id = p_household_id
    and category_id = p_category_id
    and product_id is null;

  delete from public.kitchen_categories
  where id = p_category_id and household_id = p_household_id;
end;
$$;

-- Lagerort löschen und alle Artikel auf „Sonstiges“ verschieben.
create or replace function public.delete_location(
  p_household_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name     text;
  v_fallback uuid;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Lagerorte zu löschen.';
  end if;

  select name into v_name
  from public.kitchen_locations
  where id = p_location_id and household_id = p_household_id;

  if v_name is null then
    raise exception 'Lagerort nicht gefunden.';
  end if;
  if lower(btrim(v_name)) = 'sonstiges' then
    raise exception 'Der Lagerort „Sonstiges“ kann nicht gelöscht werden.';
  end if;

  select id into v_fallback
  from public.kitchen_locations
  where household_id = p_household_id
    and lower(btrim(name)) = 'sonstiges';

  if v_fallback is null then
    insert into public.kitchen_locations (household_id, name, sort_order)
    values (p_household_id, 'Sonstiges', 999)
    returning id into v_fallback;
  end if;

  update public.kitchen_products
  set last_location_id = v_fallback
  where household_id = p_household_id
    and last_location_id = p_location_id;

  update public.kitchen_items
  set location_id = v_fallback
  where household_id = p_household_id
    and location_id = p_location_id;

  delete from public.kitchen_locations
  where id = p_location_id and household_id = p_household_id;
end;
$$;

-- Einheit löschen und alle Artikel auf „Stück“ verschieben.
create or replace function public.delete_unit(
  p_household_id uuid,
  p_unit_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name     text;
  v_fallback uuid;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Einheiten zu löschen.';
  end if;

  select name into v_name
  from public.kitchen_units
  where id = p_unit_id and household_id = p_household_id;

  if v_name is null then
    raise exception 'Einheit nicht gefunden.';
  end if;
  if lower(btrim(v_name)) = 'stück' then
    raise exception 'Die Einheit „Stück“ kann nicht gelöscht werden.';
  end if;

  select id into v_fallback
  from public.kitchen_units
  where household_id = p_household_id
    and lower(btrim(name)) = 'stück';

  if v_fallback is null then
    insert into public.kitchen_units (household_id, name, step_size, sort_order)
    values (p_household_id, 'Stück', 1, 10)
    returning id into v_fallback;
  end if;

  update public.kitchen_products
  set unit_id = v_fallback
  where household_id = p_household_id
    and unit_id = p_unit_id;

  -- Produkt-Trigger verteilen die neue Einheit an verknüpfte Artikel;
  -- hier bleiben nur Artikel ohne Produktgruppe übrig.
  update public.kitchen_items
  set unit_id = v_fallback
  where household_id = p_household_id
    and unit_id = p_unit_id
    and product_id is null;

  delete from public.kitchen_units
  where id = p_unit_id and household_id = p_household_id;
end;
$$;

-- Sucht eine Barcode-Gruppe oder legt das Produktwissen erstmals an. Produkte
-- ohne Barcode entstehen nur auf expliziten Wunsch; sie sind manuell verknüpfbar.
create or replace function public.find_or_create_kitchen_product(
  p_household_id uuid,
  p_barcode text,
  p_name text,
  p_category_id uuid,
  p_unit_id uuid
)
returns table (product_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Produktgruppen zu ändern.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Der Produktname darf nicht leer sein.';
  end if;
  if p_barcode is not null and p_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'Ein Barcode muss aus 8 bis 14 Ziffern bestehen.';
  end if;

  if p_barcode is null then
    insert into public.kitchen_products
      (household_id, barcode, name, category_id, unit_id)
    values
      (p_household_id, null, btrim(p_name), p_category_id, p_unit_id)
    returning id into v_product_id;
    return query select v_product_id, true;
    return;
  end if;

  insert into public.kitchen_products
    (household_id, barcode, name, category_id, unit_id)
  values
    (p_household_id, p_barcode, btrim(p_name), p_category_id, p_unit_id)
  on conflict (household_id, barcode) where barcode is not null do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    return query select v_product_id, true;
    return;
  end if;

  select p.id into v_product_id
  from public.kitchen_products p
  where p.household_id = p_household_id
    and p.barcode = p_barcode;
  if v_product_id is null then
    raise exception 'Produktgruppe konnte nicht angelegt werden.';
  end if;
  return query select v_product_id, false;
end;
$$;

-- Gemeinsame Produktattribute plus die Einzelattribute eines Artikels werden
-- atomar gespeichert. Die Produkt-Trigger verteilen Name/Kategorie/Einheit/Foto.
create or replace function public.update_kitchen_product_item(
  p_household_id uuid,
  p_item_id uuid,
  p_expected_version integer,
  p_name text,
  p_barcode text,
  p_category_id uuid,
  p_unit_id uuid,
  p_photo_path text,
  p_qty numeric,
  p_location_id uuid,
  p_expiry date,
  p_purchased_at date,
  p_notes text,
  p_checked boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
  v_version integer;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Du hast in diesem Haushalt nur Leserechte.';
  end if;
  if p_barcode is not null and p_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'Ein Barcode muss aus 8 bis 14 Ziffern bestehen.';
  end if;

  select i.product_id, i.version
    into v_product_id, v_version
  from public.kitchen_items i
  where i.id = p_item_id
    and i.household_id = p_household_id
    and i.deleted_at is null
  for update;

  if not found or v_product_id is null then
    raise exception 'Produktartikel wurde nicht gefunden.';
  end if;
  if p_expected_version is not null and v_version <> p_expected_version then
    raise exception 'Der Artikel wurde inzwischen geändert. Bitte erneut öffnen.';
  end if;

  update public.kitchen_products
  set name = btrim(p_name),
      barcode = p_barcode,
      category_id = p_category_id,
      unit_id = p_unit_id,
      photo_path = p_photo_path
  where id = v_product_id
    and household_id = p_household_id;

  if not found then
    raise exception 'Produktgruppe wurde nicht gefunden.';
  end if;

  update public.kitchen_items
  set qty = p_qty,
      location_id = p_location_id,
      expiry = p_expiry,
      purchased_at = p_purchased_at,
      notes = coalesce(p_notes, ''),
      checked = case when kind = 'shop' then coalesce(p_checked, false) else false end
  where id = p_item_id
    and household_id = p_household_id
    and deleted_at is null;
end;
$$;

-- Löscht eine Gruppe nur, wenn keine aktiven Artikel mehr daran hängen
-- (Einstellungen → Ungenutzte Produktgruppen). Gibt den Foto-Pfad zurück.
create or replace function public.delete_unused_kitchen_product(
  p_household_id uuid,
  p_product_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_photo_path text;
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Produktgruppen zu löschen.';
  end if;

  delete from public.kitchen_products p
  where p.id = p_product_id
    and p.household_id = p_household_id
    and not exists (
      select 1
      from public.kitchen_items i
      where i.product_id = p.id
        and i.deleted_at is null
    )
  returning p.photo_path into v_photo_path;

  return v_photo_path;
end;
$$;

-- Räumt verwaiste, nicht-saisonale Gruppen nach Inaktivität auf. Liefert die
-- gelöschten IDs und Foto-Pfade zum Aufräumen im Storage zurück.
create or replace function public.cleanup_unused_kitchen_products(
  p_household_id uuid,
  p_min_age_days integer default 180
)
returns table (product_id uuid, photo_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_household_permission(p_household_id, 'write') then
    raise exception 'Keine Berechtigung, Produktgruppen aufzuräumen.';
  end if;

  return query
  delete from public.kitchen_products p
  where p.household_id = p_household_id
    and p.seasonal = false
    and not exists (
      select 1
      from public.kitchen_items i
      where i.product_id = p.id
        and i.deleted_at is null
    )
    and greatest(
      p.updated_at,
      coalesce(
        (
          select max(i.updated_at)
          from public.kitchen_items i
          where i.product_id = p.id
        ),
        p.created_at
      )
    ) < now() - make_interval(days => greatest(p_min_age_days, 1))
  returning p.id, p.photo_path;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Storage
-- ----------------------------------------------------------------------------
-- Privater Bucket für Produktfotos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false;

-- Pfad: product-photos/{household_id}/{item_id_oder_product_id}/{datei}.jpg
-- Altpfade {user_id}/{item_id}.jpg bleiben für den Eigentümer lesbar.
--
-- Zuerst die alten, viel zu offenen Policies des Prototyps entfernen:
-- sie erlaubten jedem angemeldeten Benutzer Zugriff auf alle Fotos.
drop policy if exists "Authenticated users can view product photos"   on storage.objects;
drop policy if exists "Authenticated users can upload product photos" on storage.objects;
drop policy if exists "Authenticated users can update product photos" on storage.objects;
drop policy if exists "Authenticated users can delete product photos" on storage.objects;

drop policy if exists "product photos read"   on storage.objects;
drop policy if exists "product photos insert" on storage.objects;
drop policy if exists "product photos update" on storage.objects;
drop policy if exists "product photos delete" on storage.objects;

create policy "product photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-photos'
    and (
      -- Neuer Pfad: Haushaltsmitglieder dürfen lesen.
      public.has_household_permission(
        public.storage_household_id(name), 'read'
      )
      -- Artikel-Foto (auch Altpfad), wenn der Artikel im eigenen Haushalt liegt.
      or exists (
        select 1
        from public.kitchen_items i
        where i.photo_path = storage.objects.name
          and public.has_household_permission(i.household_id, 'read')
      )
      -- Altpfad {user_id}/…: nur der Eigentümer.
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "product photos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-photos'
    and (
      public.has_household_permission(
        public.storage_household_id(name), 'write'
      )
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "product photos update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-photos'
    and (
      public.has_household_permission(
        public.storage_household_id(name), 'write'
      )
      or (
        owner_id::text = (select auth.uid())::text
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  )
  with check (
    bucket_id = 'product-photos'
    and (
      public.has_household_permission(
        public.storage_household_id(name), 'write'
      )
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "product photos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-photos'
    and (
      public.has_household_permission(
        public.storage_household_id(name), 'write'
      )
      or (
        owner_id::text = (select auth.uid())::text
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 13. Grants: Least Privilege
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from public;
revoke all on all functions in schema public from anon;
revoke usage on schema public from anon;

grant usage on schema public to authenticated;

grant select on public.household_roles to authenticated;

grant select, insert, update on public.profiles to authenticated;

grant select, update, delete on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.household_invites to authenticated;

grant select, insert, update, delete on public.kitchen_items to authenticated;
grant select, insert, update, delete on public.kitchen_categories to authenticated;
grant select, insert, update, delete on public.kitchen_locations to authenticated;
grant select, insert, update, delete on public.kitchen_units to authenticated;
grant select, insert, update on public.kitchen_products to authenticated;
grant select, insert, update, delete on public.kitchen_category_settings to authenticated;
grant select, insert, update, delete on public.kitchen_quick_filters to authenticated;
grant select, insert, update, delete on public.kitchen_quick_filter_categories to authenticated;
grant select, insert, update, delete on public.external_product_mappings to authenticated;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_permission(uuid, text) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;
grant execute on function public.storage_household_id(text) to authenticated;

-- Trigger-Funktionen werden bei Tabellenänderungen ausgeführt und benötigen
-- für SECURITY INVOKER ebenfalls EXECUTE.
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_item_metadata() to authenticated;
grant execute on function public.validate_product_household_refs() to authenticated;
grant execute on function public.sync_product_fields_on_item() to authenticated;
grant execute on function public.propagate_product_fields_to_items() to authenticated;
grant execute on function public.remember_product_location() to authenticated;
grant execute on function public.validate_item_household_refs() to authenticated;
grant execute on function public.protect_last_owner() to authenticated;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.get_household_members(uuid) to authenticated;
grant execute on function public.create_household_invite(uuid, text, text) to authenticated;
grant execute on function public.get_household_invite(text) to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;
grant execute on function public.delete_category(uuid, uuid) to authenticated;
grant execute on function public.delete_location(uuid, uuid) to authenticated;
grant execute on function public.delete_unit(uuid, uuid) to authenticated;
grant execute on function public.find_or_create_kitchen_product(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.update_kitchen_product_item(uuid, uuid, integer, text, text, uuid, uuid, text, numeric, uuid, date, date, text, boolean) to authenticated;
grant execute on function public.delete_unused_kitchen_product(uuid, uuid) to authenticated;
grant execute on function public.cleanup_unused_kitchen_products(uuid, integer) to authenticated;

commit;

notify pgrst, 'reload schema';
