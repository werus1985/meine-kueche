-- ============================================================================
-- Schema-Rechte nach dem Neuaufbau
-- ============================================================================
-- Der historische Schema-Dump hatte `service_role` die Rechte auf `public`
-- entzogen. Nach `db reset --linked` fehlt dadurch das Schema-USAGE, wodurch
-- PostgREST mit „permission denied for schema public“ antwortet (u. a. für
-- /api/health).
--
-- `service_role` wird ausschließlich serverseitig verwendet und bekommt nur
-- Leserechte auf die Tabelle, die der Health-Check braucht.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.households to service_role;
