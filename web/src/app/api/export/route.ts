import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getActiveHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/**
 * Datenexport des aktiven Haushalts als JSON-Download (DSGVO-Auskunft).
 * KI-Keys sind bewusst nicht enthalten.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Nicht angemeldet", { status: 401 });
  }

  const context = await getActiveHousehold();
  if (!context) {
    return new NextResponse("Kein Haushalt ausgewählt", { status: 404 });
  }

  const householdId = context.active.id;
  const supabase = await createClient();

  const [
    profile,
    household,
    members,
    items,
    products,
    categories,
    locations,
    units,
    recipes,
    ingredients,
    steps,
    quickFilters,
    quickFilterCategories,
    categorySettings,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("households")
      .select("id, name, external_lookup_enabled, created_at, updated_at")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("user_id, role, joined_at")
      .eq("household_id", householdId),
    supabase.from("kitchen_items").select("*").eq("household_id", householdId),
    supabase.from("kitchen_products").select("*").eq("household_id", householdId),
    supabase.from("kitchen_categories").select("*").eq("household_id", householdId),
    supabase.from("kitchen_locations").select("*").eq("household_id", householdId),
    supabase.from("kitchen_units").select("*").eq("household_id", householdId),
    supabase.from("kitchen_recipes").select("*").eq("household_id", householdId),
    supabase
      .from("kitchen_recipe_ingredients")
      .select("*")
      .eq("household_id", householdId),
    supabase.from("kitchen_recipe_steps").select("*").eq("household_id", householdId),
    supabase.from("kitchen_quick_filters").select("*").eq("household_id", householdId),
    supabase
      .from("kitchen_quick_filter_categories")
      .select("*")
      .eq("household_id", householdId),
    supabase
      .from("kitchen_category_settings")
      .select("*")
      .eq("household_id", householdId),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      profile: profile.data ?? null,
    },
    household: household.data ?? null,
    members: members.data ?? [],
    items: items.data ?? [],
    products: products.data ?? [],
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    units: units.data ?? [],
    quickFilters: quickFilters.data ?? [],
    quickFilterCategories: quickFilterCategories.data ?? [],
    categorySettings: categorySettings.data ?? [],
    recipes: recipes.data ?? [],
    recipeIngredients: ingredients.data ?? [],
    recipeSteps: steps.data ?? [],
  };

  const filename = `meine-kueche-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
