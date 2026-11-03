-- ============================================================================
-- Rezepte pro Haushalt
-- ============================================================================
-- * kitchen_recipes: Rezeptkopf (Titel, Beschreibung, Basis-Portionen, Quelle,
--   Foto, optionaler Quell-Link). Soft-Delete wie bei Artikeln.
-- * kitchen_recipe_ingredients / kitchen_recipe_steps: Zutaten und Schritte
--   mit Reihenfolge, kaskadierend am Rezept.
-- Portionen werden nur in der Anzeige skaliert; gespeichert bleibt die
-- Basis-Portionenzahl des Rezepts.
-- ============================================================================

create table public.kitchen_recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 200),
  description  text not null default '',
  servings     integer not null default 4 check (servings between 1 and 100),
  source       text not null default 'manual' check (source in ('manual', 'chat', 'link', 'photo')),
  source_url   text,
  photo_path   text,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (household_id, id)
);

create index kitchen_recipes_household_idx
  on public.kitchen_recipes (household_id) where deleted_at is null;

create trigger kitchen_recipes_set_updated_at
  before update on public.kitchen_recipes
  for each row execute function public.set_updated_at();

create table public.kitchen_recipe_ingredients (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id    uuid not null,
  name         text not null check (length(btrim(name)) between 1 and 200),
  qty          numeric check (qty is null or qty > 0),
  unit         text,
  optional     boolean not null default false,
  sort_order   integer not null default 0,
  foreign key (household_id, recipe_id)
    references public.kitchen_recipes (household_id, id) on delete cascade
);

create index kitchen_recipe_ingredients_recipe_idx
  on public.kitchen_recipe_ingredients (recipe_id, sort_order);

create table public.kitchen_recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id    uuid not null,
  text         text not null default '',
  sort_order   integer not null default 0,
  foreign key (household_id, recipe_id)
    references public.kitchen_recipes (household_id, id) on delete cascade
);

create index kitchen_recipe_steps_recipe_idx
  on public.kitchen_recipe_steps (recipe_id, sort_order);

alter table public.kitchen_recipes            enable row level security;
alter table public.kitchen_recipe_ingredients enable row level security;
alter table public.kitchen_recipe_steps       enable row level security;

create policy kitchen_recipes_select on public.kitchen_recipes
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_recipes_insert on public.kitchen_recipes
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipes_update on public.kitchen_recipes
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipes_delete on public.kitchen_recipes
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_recipe_ingredients_select on public.kitchen_recipe_ingredients
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_recipe_ingredients_insert on public.kitchen_recipe_ingredients
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipe_ingredients_update on public.kitchen_recipe_ingredients
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipe_ingredients_delete on public.kitchen_recipe_ingredients
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

create policy kitchen_recipe_steps_select on public.kitchen_recipe_steps
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));
create policy kitchen_recipe_steps_insert on public.kitchen_recipe_steps
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipe_steps_update on public.kitchen_recipe_steps
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));
create policy kitchen_recipe_steps_delete on public.kitchen_recipe_steps
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));

grant select, insert, update, delete on public.kitchen_recipes to authenticated;
grant select, insert, update, delete on public.kitchen_recipe_ingredients to authenticated;
grant select, insert, update, delete on public.kitchen_recipe_steps to authenticated;
