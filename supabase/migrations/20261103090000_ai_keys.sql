-- ============================================================================
-- KI-Zugänge (Bring your own Key)
-- ============================================================================
-- * user_ai_settings: persönlicher Gemini-API-Key pro Nutzer. Strikt
--   selbst-gesperrt (RLS): kein anderes Haushaltsmitglied kann ihn lesen.
-- * households.gemini_api_key: optionaler gemeinsamer Key des Haushalts.
--   Lesbar für alle Mitglieder (bewusst geteilt), änderbar nur mit
--   manage_household-Recht (bestehende households_update-Policy).
-- ============================================================================

create table public.user_ai_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text not null check (length(btrim(gemini_api_key)) between 10 and 200),
  updated_at     timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;

create policy user_ai_settings_select on public.user_ai_settings
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_ai_settings_insert on public.user_ai_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_ai_settings_update on public.user_ai_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_ai_settings_delete on public.user_ai_settings
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_ai_settings to authenticated;

alter table public.households
  add column if not exists gemini_api_key text,
  add constraint households_gemini_api_key_length
    check (gemini_api_key is null or length(btrim(gemini_api_key)) between 10 and 200);
