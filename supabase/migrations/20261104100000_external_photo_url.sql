-- ============================================================================
-- Externe Produktfotos (Open Food Facts)
-- ============================================================================
-- Der Import externer Bilder kann lange dauern (OFF-CDN liefert teils erst
-- nach 10–25 s). Damit das Foto sofort sichtbar ist, wird die externe URL
-- gespeichert; der Download in den eigenen Storage läuft im Hintergrund und
-- ersetzt sie anschließend (photo_path gesetzt, photo_url geleert).
-- ============================================================================

alter table public.kitchen_items
  add column if not exists photo_url text;

alter table public.kitchen_products
  add column if not exists photo_url text;
