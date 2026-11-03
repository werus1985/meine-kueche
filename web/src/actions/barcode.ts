"use server";

import {
  guessCategoryId,
  guessUnitId,
  lookupExternalProduct,
} from "@/lib/barcode-lookup";
import { getActiveHousehold, getCategories, getUnits } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { normalizeBarcode } from "@/lib/utils";

export type BarcodeLookup = {
  found: boolean;
  name: string | null;
  categoryId: string | null;
  unitId: string | null;
  photoUrl: string | null;
  tags: string[];
};

const NOT_FOUND: BarcodeLookup = {
  found: false,
  name: null,
  categoryId: null,
  unitId: null,
  photoUrl: null,
  tags: [],
};

/**
 * Externe Produktdaten (Open Food Facts) zu einem Barcode. Läuft nur, wenn
 * der Haushalt den Lookup erlaubt und der Barcode lokal unbekannt ist –
 * lokales Produktwissen gewinnt immer.
 */
export async function lookupBarcodeAction(
  barcode: string,
): Promise<BarcodeLookup> {
  const context = await getActiveHousehold();
  if (!context) return NOT_FOUND;

  const normalized = normalizeBarcode(barcode);
  if (!/^\d{8,14}$/.test(normalized)) return NOT_FOUND;

  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("external_lookup_enabled")
    .eq("id", context.active.id)
    .maybeSingle();
  if (!household?.external_lookup_enabled) return NOT_FOUND;

  // Lokal bekannt? Dann nie extern nachschlagen.
  const { data: localProduct } = await supabase
    .from("kitchen_products")
    .select("id")
    .eq("household_id", context.active.id)
    .eq("barcode", normalized)
    .maybeSingle();
  if (localProduct) return NOT_FOUND;

  const external = await lookupExternalProduct(normalized);
  if (!external) return NOT_FOUND;

  const [categories, units] = await Promise.all([
    getCategories(context.active.id),
    getUnits(context.active.id),
  ]);

  const tags = external.tags.slice(0, 12);
  let learnedCategoryId: string | null = null;
  let learnedUnitId: string | null = null;

  if (tags.length > 0) {
    const { data: mappings } = await supabase
      .from("external_product_mappings")
      .select("tag, category_id, unit_id")
      .eq("household_id", context.active.id)
      .eq("source", "openfoodfacts")
      .in("tag", tags);

    if (mappings) {
      const byTag = new Map(mappings.map((mapping) => [mapping.tag, mapping]));
      // Reihenfolge der Tags beibehalten (spezifisch → allgemein).
      for (const tag of tags) {
        const mapping = byTag.get(tag);
        if (!learnedCategoryId && mapping?.category_id) {
          learnedCategoryId = mapping.category_id;
        }
        if (!learnedUnitId && mapping?.unit_id) {
          learnedUnitId = mapping.unit_id;
        }
      }
    }
  }

  const categoryId =
    learnedCategoryId ??
    guessCategoryId(
      tags,
      categories.map(({ id, name }) => ({ id, name })),
    );
  const unitId =
    learnedUnitId ??
    guessUnitId(
      external.quantity,
      units.map(({ id, name }) => ({ id, name })),
    );

  return {
    found: true,
    name: external.name,
    categoryId,
    unitId,
    photoUrl: external.imageUrl,
    tags,
  };
}
