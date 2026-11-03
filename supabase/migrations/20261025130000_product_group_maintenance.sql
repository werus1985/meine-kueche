-- ============================================================================
-- Produktgruppen: Saisonal-Schutz und Aufräum-RPCs
-- ============================================================================
-- * kitchen_products.seasonal: schützt eine Gruppe dauerhaft vor der
--   automatischen Löschung (z. B. Weihnachtsgebäck).
-- * delete_unused_kitchen_product: Einzellöschung aus den Einstellungen –
--   nur für Gruppen ohne aktive Artikel (in der DB erzwungen).
-- * cleanup_unused_kitchen_products: räumt verwaiste, nicht-saisonale
--   Gruppen nach einer Inaktivitätsfrist auf (Standard: 180 Tage).
--
-- Bewusst keine DELETE-Policy auf kitchen_products: Löschen ist nur über
-- diese Security-Definer-RPCs möglich, die die Invariante "keine aktiven
-- Artikel" selbst prüfen.
-- ============================================================================

alter table public.kitchen_products
  add column if not exists seasonal boolean not null default false;

-- Löscht eine ungenutzte Gruppe und liefert den Foto-Pfad zum Aufräumen
-- im Storage zurück (NULL, wenn kein Foto oder nichts gelöscht wurde).
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

-- Räumt verwaiste Gruppen auf: keine aktiven Artikel, nicht saisonal und
-- die letzte Aktivität (Produkt- oder Artikeländerung, inkl. Löschzeitpunkt)
-- liegt länger als p_min_age_days zurück. Liefert die Foto-Pfade zurück.
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

grant execute on function public.delete_unused_kitchen_product(uuid, uuid) to authenticated;
grant execute on function public.cleanup_unused_kitchen_products(uuid, integer) to authenticated;
