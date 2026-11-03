import "server-only";

import { getActiveHousehold } from "@/lib/data";
import { decryptSecret } from "@/lib/secret";
import { createClient } from "@/lib/supabase/server";

export type GeminiKeySource = "user" | "household";

export type ResolvedGeminiKey = {
  key: string;
  source: GeminiKeySource;
};

export const AI_KEY_MISSING_MESSAGE =
  "Für die KI fehlt noch ein Gemini-API-Key. Hinterlege deinen eigenen unter Einstellungen → Profil oder einen gemeinsamen Key unter Einstellungen → Haushalt.";

/**
 * Persönlicher Key des angemeldeten Nutzers hat Vorrang, danach der
 * gemeinsame Key des aktiven Haushalts. Kein serverweiter Fallback.
 */
export async function resolveGeminiKey(): Promise<ResolvedGeminiKey | null> {
  const context = await getActiveHousehold();
  if (!context) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: personal } = await supabase
    .from("user_ai_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();
  if (personal?.gemini_api_key) {
    const key = decryptSecret(personal.gemini_api_key);
    if (key) return { key, source: "user" };
    console.error("Persönlicher KI-Key ist nicht entschlüsselbar.");
  }

  const { data: household } = await supabase
    .from("households")
    .select("gemini_api_key")
    .eq("id", context.active.id)
    .maybeSingle();
  if (household?.gemini_api_key) {
    const key = decryptSecret(household.gemini_api_key);
    if (key) return { key, source: "household" };
    console.error("Haushalts-KI-Key ist nicht entschlüsselbar.");
  }

  return null;
}

/** Für die Shell/UI: ist überhaupt ein Key verfügbar? */
export async function hasGeminiKey(): Promise<boolean> {
  return (await resolveGeminiKey()) !== null;
}
