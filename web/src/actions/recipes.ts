"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveHousehold } from "@/lib/data";
import { removePhoto, uploadPhoto } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { FormState, RecipeIngredient, RecipeStep } from "@/lib/types";

const MAX_INGREDIENTS = 100;
const MAX_STEPS = 50;

const KNOWN_UNITS =
  /^(g|kg|mg|ml|l|cl|dl|el|tl|st(ü|ue)ck|stk\.?|prise[n]?|dose[n]?|packung[en]?|bund|zehe[n]?|scheibe[n]?|becher|tasse[n]?|x)$/i;

function parseQuantity(value: unknown): number | null {
  const text = String(value ?? "").replace(",", ".").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 1000) / 1000;
}

function normalizeIngredients(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      name: String(entry.name ?? "").trim().slice(0, 200),
      qty: parseQuantity(entry.qty),
      unit: String(entry.unit ?? "").trim().slice(0, 30) || null,
      optional: Boolean(entry.optional),
    }))
    .filter((entry) => entry.name.length > 0)
    .slice(0, MAX_INGREDIENTS);
}

function normalizeSteps(raw: unknown): RecipeStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : String((entry as Record<string, unknown> | null)?.text ?? ""),
    )
    .map((text) => text.trim().slice(0, 2000))
    .filter((text) => text.length > 0)
    .slice(0, MAX_STEPS)
    .map((text) => ({ text }));
}

/** Zutatentext aus dem Chat („250 ml Milch“) in Menge/Einheit/Name zerlegen. */
function parseIngredientLine(line: string): RecipeIngredient | null {
  const text = line.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!text) return null;

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return { name: text, qty: null, unit: null, optional: false };

  const qty = parseQuantity(match[1]);
  const rest = match[2].trim();
  if (qty === null || !rest) {
    return { name: text, qty: null, unit: null, optional: false };
  }

  const [first, ...others] = rest.split(" ");
  if (first && others.length > 0 && KNOWN_UNITS.test(first)) {
    return { name: others.join(" "), qty, unit: first, optional: false };
  }
  return { name: rest, qty, unit: null, optional: false };
}

async function ensureWriteContext() {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  return context.active.canWrite ? context : null;
}

/** Rezept aus dem KI-Chat speichern. */
export async function saveRecipeFromChatAction(
  recipe: {
    name?: string;
    description?: string;
    servings?: number;
    ingredients?: string[];
    steps?: string[];
  },
): Promise<{ ok: boolean; message: string }> {
  const context = await ensureWriteContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const title = String(recipe?.name ?? "").trim().slice(0, 200);
  if (!title) return { ok: false, message: "Das Rezept hat keinen Namen." };

  const servingsRaw = Number(recipe?.servings);
  const servings =
    Number.isFinite(servingsRaw) && servingsRaw >= 1 && servingsRaw <= 100
      ? Math.round(servingsRaw)
      : 4;

  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((line) => parseIngredientLine(String(line ?? "")))
    .filter((entry): entry is RecipeIngredient => entry !== null)
    .slice(0, MAX_INGREDIENTS);
  const steps = normalizeSteps(recipe?.steps);

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("kitchen_recipes")
    .insert({
      household_id: context.active.id,
      title,
      description: String(recipe?.description ?? "").trim().slice(0, 2000),
      servings,
      source: "chat",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Rezept konnte nicht gespeichert werden." };
  }

  if (ingredients.length > 0) {
    await supabase.from("kitchen_recipe_ingredients").insert(
      ingredients.map((entry, index) => ({
        household_id: context.active.id,
        recipe_id: inserted.id,
        name: entry.name,
        qty: entry.qty,
        unit: entry.unit,
        optional: entry.optional,
        sort_order: index,
      })),
    );
  }
  if (steps.length > 0) {
    await supabase.from("kitchen_recipe_steps").insert(
      steps.map((entry, index) => ({
        household_id: context.active.id,
        recipe_id: inserted.id,
        text: entry.text,
        sort_order: index,
      })),
    );
  }

  revalidatePath("/recipes");
  return { ok: true, message: `„${title}“ wurde gespeichert.` };
}

/** Rezept manuell anlegen oder bearbeiten. */
export async function saveRecipeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await ensureWriteContext();
  if (!context) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const servingsRaw = Number(formData.get("servings"));
  const servings =
    Number.isFinite(servingsRaw) && servingsRaw >= 1 && servingsRaw <= 100
      ? Math.round(servingsRaw)
      : 4;
  const sourceUrlRaw = String(formData.get("source_url") ?? "").trim();
  const sourceUrl =
    sourceUrlRaw && /^https?:\/\/\S+$/i.test(sourceUrlRaw)
      ? sourceUrlRaw.slice(0, 1000)
      : null;

  if (!title) return { ok: false, message: "Bitte einen Titel eingeben." };

  let ingredients: RecipeIngredient[] = [];
  let steps: RecipeStep[] = [];
  try {
    ingredients = normalizeIngredients(JSON.parse(String(formData.get("ingredients") ?? "[]")));
    steps = normalizeSteps(JSON.parse(String(formData.get("steps") ?? "[]")));
  } catch {
    return { ok: false, message: "Zutaten oder Schritte konnten nicht gelesen werden." };
  }
  if (ingredients.length === 0) {
    return { ok: false, message: "Bitte mindestens eine Zutat eingeben." };
  }

  const supabase = await createClient();
  const photo = formData.get("photo");
  const removeExistingPhoto = formData.get("removePhoto") === "1";

  let recipeId = id;
  let previousPhotoPath: string | null = null;

  if (recipeId) {
    const { data: existing } = await supabase
      .from("kitchen_recipes")
      .select("id, photo_path")
      .eq("id", recipeId)
      .eq("household_id", context.active.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return { ok: false, message: "Rezept wurde nicht gefunden." };
    previousPhotoPath = existing.photo_path;
  }

  let photoPath = previousPhotoPath;
  if (photo instanceof File && photo.size > 0 && recipeId) {
    const upload = await uploadPhoto(context.active.id, recipeId, photo);
    if (upload.error) return { ok: false, message: upload.error };
    if (upload.path) photoPath = upload.path;
  } else if (removeExistingPhoto) {
    photoPath = null;
  }

  if (!recipeId) {
    const { data: inserted, error } = await supabase
      .from("kitchen_recipes")
      .insert({
        household_id: context.active.id,
        title,
        description,
        servings,
        source: "manual",
        source_url: sourceUrl,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, message: error?.message ?? "Rezept konnte nicht angelegt werden." };
    }
    recipeId = inserted.id;

    if (photo instanceof File && photo.size > 0) {
      const upload = await uploadPhoto(context.active.id, recipeId, photo);
      if (upload.error) return { ok: false, message: upload.error };
      if (upload.path) photoPath = upload.path;
    }

    if (photoPath) {
      await supabase
        .from("kitchen_recipes")
        .update({ photo_path: photoPath })
        .eq("id", recipeId)
        .eq("household_id", context.active.id);
    }
  } else {
    const { error } = await supabase
      .from("kitchen_recipes")
      .update({
        title,
        description,
        servings,
        source_url: sourceUrl,
        photo_path: photoPath,
      })
      .eq("id", recipeId)
      .eq("household_id", context.active.id);
    if (error) return { ok: false, message: error.message };

    if (photoPath !== previousPhotoPath) {
      await removePhoto(previousPhotoPath);
    }

    await supabase
      .from("kitchen_recipe_ingredients")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("household_id", context.active.id);
    await supabase
      .from("kitchen_recipe_steps")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("household_id", context.active.id);
  }

  if (!recipeId) return { ok: false, message: "Rezept konnte nicht gespeichert werden." };

  if (ingredients.length > 0) {
    const { error } = await supabase.from("kitchen_recipe_ingredients").insert(
      ingredients.map((entry, index) => ({
        household_id: context.active.id,
        recipe_id: recipeId,
        name: entry.name,
        qty: entry.qty,
        unit: entry.unit,
        optional: entry.optional,
        sort_order: index,
      })),
    );
    if (error) return { ok: false, message: error.message };
  }
  if (steps.length > 0) {
    const { error } = await supabase.from("kitchen_recipe_steps").insert(
      steps.map((entry, index) => ({
        household_id: context.active.id,
        recipe_id: recipeId,
        text: entry.text,
        sort_order: index,
      })),
    );
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/recipes");
  redirect("/recipes?saved=1");
}

export async function deleteRecipeAction(formData: FormData): Promise<void> {
  const context = await ensureWriteContext();
  if (!context) redirect("/recipes?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/recipes");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("kitchen_recipes")
    .select("id, photo_path")
    .eq("id", id)
    .eq("household_id", context.active.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("kitchen_recipes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", context.active.id);
    await removePhoto(existing.photo_path);
  }

  revalidatePath("/recipes");
  redirect("/recipes?deleted=1");
}
