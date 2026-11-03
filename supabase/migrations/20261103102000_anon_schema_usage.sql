-- ============================================================================
-- Schema-Zugriff für die Einladungs-Registrierung
-- ============================================================================
-- `anon` hat im Zielschema keine Tabellen-Rechte, aber auch kein USAGE auf
-- `public`. Für die Registrierung muss die öffentliche Funktion
-- `get_invite_signup` vor dem Login aufrufbar sein.
--
-- Sicherheit: Es gibt weiterhin keine Grants für `anon` auf Tabellen/Views.
-- Die beiden weiteren für `anon` erreichbaren Funktionen
-- (`cleanup_unused_kitchen_products`, `delete_unused_kitchen_product`) prüfen
-- intern `has_household_permission(..., 'write')` und schlagen ohne Anmeldung
-- fehl.
-- ============================================================================

grant usage on schema public to anon;
