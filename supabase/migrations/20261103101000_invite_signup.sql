-- ============================================================================
-- Einladungs-Registrierung
-- ============================================================================
-- Die Registrierung ist nur mit gültiger Einladung möglich. Vor dem Anlegen
-- des Kontos muss die App den Token prüfen können – ohne angemeldeten Nutzer.
-- Die Funktion gibt nur Daten gültiger, offener Einladungen zurück.
-- ============================================================================

create or replace function public.get_invite_signup(p_token text)
returns table (
  email          text,
  household_name text,
  expires_at     timestamptz,
  accepted_at    timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.email, h.name, i.expires_at, i.accepted_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
$$;

revoke all on function public.get_invite_signup(text) from public;
grant execute on function public.get_invite_signup(text) to anon, authenticated;
