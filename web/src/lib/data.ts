import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  permissionsForRole,
  type HouseholdSummary,
  type KitchenProduct,
  type RecipeIngredient,
  type RecipeStep,
  type RecipeWithDetails,
  type RoleKey,
} from "@/lib/types";

export const ACTIVE_HOUSEHOLD_COOKIE = "mk_active_household";

type HouseholdRow = {
  household_id: string;
  role: string;
  households:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export const getHouseholds = cache(async (): Promise<HouseholdSummary[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, households!inner(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("getHouseholds", error);
    return [];
  }

  return ((data ?? []) as unknown as HouseholdRow[])
    .map((row) => {
      const household = Array.isArray(row.households)
        ? row.households[0]
        : row.households;
      if (!household) return null;
      const role = row.role as RoleKey;
      return {
        id: household.id,
        name: household.name,
        role,
        ...permissionsForRole(role),
      } satisfies HouseholdSummary;
    })
    .filter((row): row is HouseholdSummary => row !== null);
});

export type HouseholdContext = {
  active: HouseholdSummary;
  households: HouseholdSummary[];
};

export const getActiveHousehold = cache(
  async (): Promise<HouseholdContext | null> => {
    const households = await getHouseholds();
    if (households.length === 0) return null;

    const cookieStore = await cookies();
    const selected = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
    const active =
      households.find((household) => household.id === selected) ?? households[0];

    return { active, households };
  },
);

export async function requireHousehold(): Promise<HouseholdContext> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  return context;
}

export async function getCategories(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_categories")
    .select("id, name, created_at")
    .eq("household_id", householdId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getCategories", error);
    return [];
  }
  return data ?? [];
}

export async function getLocations(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_locations")
    .select("id, name")
    .eq("household_id", householdId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getLocations", error);
    return [];
  }
  return data ?? [];
}

export async function getUnits(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_units")
    .select("id, name, step_size, sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getUnits", error);
    return [];
  }
  return data ?? [];
}

export async function getCategorySettings(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_category_settings")
    .select("category_id, warning_days, warning_basis, default_sort")
    .eq("household_id", householdId);

  if (error) {
    console.error("getCategorySettings", error);
    return [];
  }
  return data ?? [];
}

export type QuickFilterSummary = {
  id: string;
  name: string;
  sort_order: number;
  categoryIds: string[];
};

export async function getQuickFilters(
  householdId: string,
): Promise<QuickFilterSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_quick_filters")
    .select("id, name, sort_order, kitchen_quick_filter_categories(category_id)")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getQuickFilters", error);
    return [];
  }

  type Row = {
    id: string;
    name: string;
    sort_order: number;
    kitchen_quick_filter_categories:
      | { category_id: string }[]
      | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    categoryIds: (row.kitchen_quick_filter_categories ?? []).map(
      (entry) => entry.category_id,
    ),
  }));
}

export async function getItem(householdId: string, itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("getItem", error);
    return null;
  }
  return data;
}

// Lädt das wiederverwendbare Produktwissen inkl. Anzahl aktiver Artikel.
// `last_location_id` wird vom Trigger remember_product_location gepflegt.
export async function getProducts(householdId: string): Promise<KitchenProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_products")
    .select("id, household_id, barcode, name, category_id, unit_id, last_location_id, photo_path, seasonal, created_at, updated_at")
    .eq("household_id", householdId)
    .order("name", { ascending: true })
    .range(0, 999);
  if (error) {
    console.error("getProducts", error);
    return [];
  }

  const products = (data ?? []) as KitchenProduct[];
  if (!products.length) return products;

  const { data: itemRows, error: itemError } = await supabase
    .from("kitchen_items")
    .select("product_id, kind")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .in("product_id", products.map((product) => product.id))
    .range(0, 999);
  if (itemError) console.error("getProducts item counts", itemError);

  const itemCounts = new Map<string, number>();
  const stockItemCounts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    if (row.product_id) {
      itemCounts.set(row.product_id, (itemCounts.get(row.product_id) ?? 0) + 1);
      if (row.kind === "stock") {
        stockItemCounts.set(
          row.product_id,
          (stockItemCounts.get(row.product_id) ?? 0) + 1,
        );
      }
    }
  }
  return products.map((product) => ({
    ...product,
    itemCount: itemCounts.get(product.id) ?? 0,
    stockItemCount: stockItemCounts.get(product.id) ?? 0,
  }));
}

/**
 * Bildet Storage-Pfade auf same-origin URLs ab. Die Fotos werden über
 * `/api/photos/...` ausgeliefert (statt über signierte Storage-URLs), damit
 * sie auch bei HTTPS-App und HTTP-Supabase ohne Mixed-Content-Blockade laden.
 */
export async function getRecipes(
  householdId: string,
): Promise<RecipeWithDetails[]> {
  const supabase = await createClient();
  const [recipesResult, ingredientsResult, stepsResult] = await Promise.all([
    supabase
      .from("kitchen_recipes")
      .select(
        "id, household_id, title, description, servings, source, source_url, photo_path, created_at, updated_at",
      )
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(0, 499),
    supabase
      .from("kitchen_recipe_ingredients")
      .select("recipe_id, name, qty, unit, optional, sort_order")
      .eq("household_id", householdId)
      .order("sort_order", { ascending: true })
      .range(0, 4999),
    supabase
      .from("kitchen_recipe_steps")
      .select("recipe_id, text, sort_order")
      .eq("household_id", householdId)
      .order("sort_order", { ascending: true })
      .range(0, 4999),
  ]);

  if (recipesResult.error) {
    console.error("getRecipes", recipesResult.error);
    return [];
  }

  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>();
  for (const row of ingredientsResult.data ?? []) {
    const list = ingredientsByRecipe.get(row.recipe_id) ?? [];
    list.push({
      name: row.name,
      qty: row.qty === null ? null : Number(row.qty),
      unit: row.unit,
      optional: row.optional,
    });
    ingredientsByRecipe.set(row.recipe_id, list);
  }

  const stepsByRecipe = new Map<string, RecipeStep[]>();
  for (const row of stepsResult.data ?? []) {
    const list = stepsByRecipe.get(row.recipe_id) ?? [];
    list.push({ text: row.text });
    stepsByRecipe.set(row.recipe_id, list);
  }

  return (recipesResult.data ?? []).map((recipe) => ({
    ...recipe,
    source: recipe.source as RecipeWithDetails["source"],
    ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
    steps: stepsByRecipe.get(recipe.id) ?? [],
    photoUrl: getPhotoUrl(recipe.photo_path),
  }));
}

export async function getRecipe(
  householdId: string,
  recipeId: string,
): Promise<RecipeWithDetails | null> {
  const recipes = await getRecipes(householdId);
  return recipes.find((recipe) => recipe.id === recipeId) ?? null;
}

export function getPhotoUrl(path: string | null | undefined) {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/photos/${encoded}`;}

export async function getPhotoUrls(paths: (string | null)[]) {
  const result = new Map<string, string>();
  for (const path of paths) {
    if (!path) continue;
    result.set(path, getPhotoUrl(path) as string);
  }
  return result;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();
  return data;
}
