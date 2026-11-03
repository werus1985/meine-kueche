-- ============================================================================
-- Verschlüsselte KI-Keys
-- ============================================================================
-- Die Keys werden ab jetzt mit AES-256-GCM verschlüsselt gespeichert
-- (Format: v1.<iv>.<tag>.<cipher>, Base64url). Dadurch sind die Werte länger
-- als der bisherige Klartext-Key – die Längen-Checks werden angehoben.
-- ============================================================================

alter table public.user_ai_settings
  drop constraint if exists user_ai_settings_gemini_api_key_check;

alter table public.user_ai_settings
  add constraint user_ai_settings_gemini_api_key_check
  check (length(btrim(gemini_api_key)) between 10 and 512);

alter table public.households
  drop constraint if exists households_gemini_api_key_length;

alter table public.households
  add constraint households_gemini_api_key_length
  check (
    gemini_api_key is null
    or length(btrim(gemini_api_key)) between 10 and 512
  );
