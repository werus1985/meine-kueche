import "server-only";

import { removePhoto } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

/** Gruppen ohne aktive Artikel werden nach dieser Frist automatisch entfernt. */
export const UNUSED_PRODUCT_DAYS = 180;

/**
 * Räumt verwaiste Produktgruppen auf (keine aktiven Artikel, nicht saisonal,
 * länger als 180 Tage ungenutzt) und entfernt deren Fotos aus dem Storage.
 * Läuft still beim Laden der Startseite; Fehler blockieren die Seite nie.
 */
export async function cleanupUnusedProducts(householdId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "cleanup_unused_kitchen_products",
      {
        p_household_id: householdId,
        p_min_age_days: UNUSED_PRODUCT_DAYS,
      },
    );
    if (error || !data?.length) return;
    for (const row of data) {
      if (row.photo_path) await removePhoto(row.photo_path);
    }
  } catch {
    // Aufräumen ist Best-Effort und darf das Laden nie verhindern.
  }
}
