"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getActiveHousehold } from "@/lib/data";
import { removePhoto } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import { normalizeBarcode } from "@/lib/utils";

function friendlyDbError(message: string, code?: string) {
  if (code === "23505") {
    return "Dieser Name ist in diesem Haushalt bereits vergeben.";
  }
  if (code === "23503") {
    return "Der Eintrag wird noch verwendet und kann nicht gelöscht werden.";
  }
  return message;
}

async function writerContext() {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) return null;
  return context;
}

/* -------------------------------------------------------------------------- */
/* Kategorien                                                                 */
/* -------------------------------------------------------------------------- */

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Bitte einen Namen eingeben." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_categories")
    .insert({ household_id: context.active.id, name })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  await supabase.from("kitchen_category_settings").upsert(
    {
      household_id: context.active.id,
      category_id: data.id,
    },
    { onConflict: "household_id,category_id" },
  );

  revalidatePath("/settings/categories");
  revalidatePath("/items");
  return { ok: true, message: `Kategorie „${name}“ wurde angelegt.` };
}

export type InlineCategoryState = {
  ok: boolean;
  message: string;
  category?: { id: string; name: string };
};

/**
 * Wird direkt im Artikelformular aufgerufen, damit eine neue Kategorie ohne
 * Umweg über die Einstellungen angelegt und sofort ausgewählt werden kann.
 */
export async function createCategoryInlineAction(
  name: string,
): Promise<InlineCategoryState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Bitte einen Namen eingeben." };
  if (trimmed.length > 80) {
    return { ok: false, message: "Der Name ist zu lang (max. 80 Zeichen)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_categories")
    .insert({ household_id: context.active.id, name: trimmed })
    .select("id, name")
    .single();

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  await supabase.from("kitchen_category_settings").upsert(
    {
      household_id: context.active.id,
      category_id: data.id,
    },
    { onConflict: "household_id,category_id" },
  );

  revalidatePath("/settings/categories");
  revalidatePath("/items");
  revalidatePath("/");
  return {
    ok: true,
    message: `Kategorie „${data.name}“ wurde angelegt.`,
    category: { id: data.id, name: data.name },
  };
}

export async function renameCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { ok: false, message: "Bitte einen Namen eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_categories")
    .update({ name })
    .eq("id", id)
    .eq("household_id", context.active.id);

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  revalidatePath("/settings/categories");
  revalidatePath("/items");
  return { ok: true, message: "Kategorie wurde umbenannt." };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings/categories?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/categories");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_category", {
    p_household_id: context.active.id,
    p_category_id: id,
  });

  revalidatePath("/", "layout");

  if (error) {
    redirect(
      `/settings/categories?error=${encodeURIComponent(error.message)}`,
    );
  }
  redirect("/settings/categories?deleted=1");
}

/* -------------------------------------------------------------------------- */
/* Lagerorte                                                                  */
/* -------------------------------------------------------------------------- */

export async function createLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Bitte einen Namen eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_locations").insert({
    household_id: context.active.id,
    name,
  });

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  revalidatePath("/settings/locations");
  revalidatePath("/items");
  return { ok: true, message: `Lagerort „${name}“ wurde angelegt.` };
}

export async function renameLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { ok: false, message: "Bitte einen Namen eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_locations")
    .update({ name })
    .eq("id", id)
    .eq("household_id", context.active.id);

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  revalidatePath("/settings/locations");
  revalidatePath("/items");
  return { ok: true, message: "Lagerort wurde gespeichert." };
}

export async function deleteLocationAction(formData: FormData): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings/locations?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/locations");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_location", {
    p_household_id: context.active.id,
    p_location_id: id,
  });

  revalidatePath("/", "layout");

  if (error) {
    redirect(`/settings/locations?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/settings/locations?deleted=1");
}

/* -------------------------------------------------------------------------- */
/* Einheiten                                                                  */
/* -------------------------------------------------------------------------- */

export async function createUnitAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const stepSize = Number(String(formData.get("step_size") ?? "1").replace(",", "."));
  if (!name) return { ok: false, message: "Bitte einen Namen eingeben." };
  if (!Number.isFinite(stepSize) || stepSize <= 0) {
    return { ok: false, message: "Die Schrittgröße muss größer als 0 sein." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_units").insert({
    household_id: context.active.id,
    name,
    step_size: stepSize,
  });

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  revalidatePath("/settings/units");
  revalidatePath("/items");
  return { ok: true, message: `Einheit „${name}“ wurde angelegt.` };
}

export async function updateUnitAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const stepSize = Number(String(formData.get("step_size") ?? "1").replace(",", "."));
  if (!id || !name) {
    return { ok: false, message: "Bitte einen Namen eingeben." };
  }
  if (!Number.isFinite(stepSize) || stepSize <= 0) {
    return { ok: false, message: "Die Schrittgröße muss größer als 0 sein." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_units")
    .update({ name, step_size: stepSize })
    .eq("id", id)
    .eq("household_id", context.active.id);

  if (error) {
    return { ok: false, message: friendlyDbError(error.message, error.code) };
  }

  revalidatePath("/settings/units");
  revalidatePath("/items");
  return { ok: true, message: "Einheit wurde gespeichert." };
}

export async function deleteUnitAction(formData: FormData): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings/units?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/units");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_unit", {
    p_household_id: context.active.id,
    p_unit_id: id,
  });

  revalidatePath("/", "layout");

  if (error) {
    redirect(`/settings/units?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/settings/units?deleted=1");
}

/* -------------------------------------------------------------------------- */
/* Warnregeln                                                                 */
/* -------------------------------------------------------------------------- */

export async function saveCategoryRuleAction(formData: FormData): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings/warning-rules?error=keine-berechtigung");

  const categoryId = String(formData.get("category_id") ?? "");
  const warningDays = Number(formData.get("warning_days") ?? 2);
  const warningBasis = String(formData.get("warning_basis") ?? "expiry");
  const defaultSort = String(formData.get("default_sort") ?? "auto");

  if (!categoryId) redirect("/settings/warning-rules");

  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_category_settings").upsert(
    {
      household_id: context.active.id,
      category_id: categoryId,
      warning_days: Number.isFinite(warningDays) ? Math.max(0, warningDays) : 2,
      warning_basis: ["expiry", "purchase"].includes(warningBasis)
        ? warningBasis
        : "expiry",
      default_sort: ["auto", "expiry", "purchase", "name"].includes(defaultSort)
        ? defaultSort
        : "auto",
    },
    { onConflict: "household_id,category_id" },
  );

  revalidatePath("/settings/warning-rules");
  revalidatePath("/items");

  if (error) {
    redirect(
      `/settings/warning-rules?error=${encodeURIComponent(error.message)}`,
    );
  }
  redirect("/settings/warning-rules?saved=1");
}

/* -------------------------------------------------------------------------- */
/* Schnellfilter                                                              */
/* -------------------------------------------------------------------------- */

export async function saveQuickFilterAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0) || 0;
  const categoryIds = formData
    .getAll("categoryIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (!name) return { ok: false, message: "Bitte einen Namen eingeben." };
  if (categoryIds.length === 0) {
    return {
      ok: false,
      message: "Bitte mindestens eine Kategorie auswählen.",
    };
  }

  const supabase = await createClient();

  let filterId = id;
  if (filterId) {
    const { error } = await supabase
      .from("kitchen_quick_filters")
      .update({ name, sort_order: sortOrder })
      .eq("id", filterId)
      .eq("household_id", context.active.id);
    if (error) {
      return { ok: false, message: friendlyDbError(error.message, error.code) };
    }
  } else {
    const { data, error } = await supabase
      .from("kitchen_quick_filters")
      .insert({
        household_id: context.active.id,
        name,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, message: friendlyDbError(error.message, error.code) };
    }
    filterId = data.id;
  }

  const { error: deleteError } = await supabase
    .from("kitchen_quick_filter_categories")
    .delete()
    .eq("filter_id", filterId)
    .eq("household_id", context.active.id);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  const { error: insertError } = await supabase
    .from("kitchen_quick_filter_categories")
    .insert(
      categoryIds.map((categoryId) => ({
        household_id: context.active.id,
        filter_id: filterId,
        category_id: categoryId,
      })),
    );

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  revalidatePath("/settings/quick-filters");
  revalidatePath("/");
  revalidatePath("/items");
  return {
    ok: true,
    message: id
      ? "Schnellfilter wurde gespeichert."
      : `Schnellfilter „${name}“ wurde angelegt.`,
  };
}

export async function deleteQuickFilterAction(
  formData: FormData,
): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings/quick-filters?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/quick-filters");

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_quick_filters")
    .delete()
    .eq("id", id)
    .eq("household_id", context.active.id);

  revalidatePath("/", "layout");

  if (error) {
    redirect(
      `/settings/quick-filters?error=${encodeURIComponent(error.message)}`,
    );
  }
  redirect("/settings/quick-filters?deleted=1");
}

/* -------------------------------------------------------------------------- */
/* Profil                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil wurde gespeichert." };
}

/* -------------------------------------------------------------------------- */
/* Produktgruppen                                                             */
/* -------------------------------------------------------------------------- */

export async function updateProductGroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await writerContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const barcode = normalizeBarcode(String(formData.get("barcode") ?? "")) || null;
  const categoryId = String(formData.get("category_id") ?? "").trim() || null;
  const unitId = String(formData.get("unit_id") ?? "").trim() || null;

  if (!id) return { ok: false, message: "Produktgruppe fehlt." };
  if (name.length < 1 || name.length > 200) {
    return { ok: false, message: "Bitte einen Namen mit maximal 200 Zeichen eingeben." };
  }
  if (barcode && !/^\d{8,14}$/.test(barcode)) {
    return { ok: false, message: "Ein Barcode muss aus 8 bis 14 Ziffern bestehen." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("kitchen_products")
    .select("id")
    .eq("id", id)
    .eq("household_id", context.active.id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, message: "Produktgruppe wurde nicht gefunden." };
  }

  const { error } = await supabase
    .from("kitchen_products")
    .update({
      name,
      barcode,
      category_id: categoryId,
      unit_id: unitId,
    })
    .eq("id", id)
    .eq("household_id", context.active.id);

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Dieser Barcode ist bereits einer anderen Gruppe zugeordnet."
          : friendlyDbError(error.message, error.code),
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Produktgruppe wurde gespeichert." };
}

export async function toggleProductGroupSeasonalAction(
  formData: FormData,
): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings?section=produktgruppen");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("kitchen_products")
    .select("seasonal")
    .eq("id", id)
    .eq("household_id", context.active.id)
    .maybeSingle();

  if (product) {
    await supabase
      .from("kitchen_products")
      .update({ seasonal: !product.seasonal })
      .eq("id", id)
      .eq("household_id", context.active.id);
  }

  revalidatePath("/", "layout");
}

export async function deleteProductGroupAction(formData: FormData): Promise<void> {
  const context = await writerContext();
  if (!context) redirect("/settings?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings?section=produktgruppen");

  const supabase = await createClient();
  const { data: photoPath, error } = await supabase.rpc(
    "delete_unused_kitchen_product",
    {
      p_household_id: context.active.id,
      p_product_id: id,
    },
  );

  if (error) {
    redirect(
      `/settings?section=produktgruppen&error=${encodeURIComponent(error.message)}`,
    );
  }

  await removePhoto(photoPath);
  revalidatePath("/", "layout");
  redirect("/settings?section=produktgruppen");
}

/* -------------------------------------------------------------------------- */
/* KI-Zugänge (Gemini-Keys)                                                   */
/* -------------------------------------------------------------------------- */

function normalizeGeminiKey(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

const GEMINI_KEY_HINT =
  "Der Gemini-API-Key sieht ungültig aus (10–200 Zeichen, keine Leerzeichen).";

export async function saveUserGeminiKeyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const key = normalizeGeminiKey(formData.get("gemini_api_key"));
  if (key.length < 10 || key.length > 200) {
    return { ok: false, message: GEMINI_KEY_HINT };
  }

  const { error } = await supabase.from("user_ai_settings").upsert(
    {
      user_id: user.id,
      gemini_api_key: key,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Persönlicher Gemini-Key wurde gespeichert." };
}

export async function removeUserGeminiKeyAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("user_ai_settings").delete().eq("user_id", user.id);
  revalidatePath("/", "layout");
}

export async function saveHouseholdGeminiKeyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canManageHousehold) {
    return {
      ok: false,
      message: "Nur Eigentümer dürfen den gemeinsamen KI-Key ändern.",
    };
  }

  const key = normalizeGeminiKey(formData.get("gemini_api_key"));
  if (key.length < 10 || key.length > 200) {
    return { ok: false, message: GEMINI_KEY_HINT };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ gemini_api_key: key })
    .eq("id", context.active.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Gemeinsamer Gemini-Key wurde gespeichert." };
}

export async function removeHouseholdGeminiKeyAction(): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canManageHousehold) {
    redirect("/settings/household?error=keine-berechtigung");
  }

  const supabase = await createClient();
  await supabase
    .from("households")
    .update({ gemini_api_key: null })
    .eq("id", context.active.id);
  revalidatePath("/", "layout");
}
