import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Admin-Client mit Service-Role-Key. Ausschließlich serverseitig und nur für
 * Aufgaben, die die normale Session nicht kann (z. B. Auth-User löschen).
 * `null`, wenn der Key nicht konfiguriert ist.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) return null;

  return createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
