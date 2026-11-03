"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const CONFIRM_WORD = "LÖSCHEN";

/**
 * Löscht das eigene Konto samt Daten.
 *
 * - Haushalte, in denen man alleiniges Mitglied ist, werden komplett gelöscht
 *   (inklusive Fotos im Storage).
 * - Ist man alleiniger Eigentümer eines Haushalts mit weiteren Mitgliedern,
 *   wird abgebrochen – erst Eigentümerschaft übertragen.
 * - Der Auth-User wird über die Admin-API entfernt (Service-Role-Key).
 */
export async function deleteAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== CONFIRM_WORD) {
    return {
      ok: false,
      message: `Bitte zur Bestätigung ${CONFIRM_WORD} eingeben.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Bitte melde dich erneut an." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      message:
        "Die Kontolöschung ist auf diesem Server nicht eingerichtet (SUPABASE_SERVICE_ROLE_KEY fehlt).",
    };
  }

  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id);

  const ownedHouseholdIds = (memberships ?? [])
    .filter((entry) => entry.role === "owner")
    .map((entry) => entry.household_id);

  const deletableHouseholds: string[] = [];
  for (const householdId of ownedHouseholdIds) {
    const [{ count }, { data: owners }] = await Promise.all([
      supabase
        .from("household_members")
        .select("user_id", { count: "exact", head: true })
        .eq("household_id", householdId),
      supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .eq("role", "owner"),
    ]);

    const otherOwners = (owners ?? []).filter(
      (owner) => owner.user_id !== user.id,
    ).length;
    const members = count ?? 0;

    if (members > 1 && otherOwners === 0) {
      return {
        ok: false,
        message:
          "Du bist alleiniger Eigentümer eines Haushalts mit weiteren Mitgliedern. Übertrage zuerst die Eigentümerschaft oder entferne die Mitglieder.",
      };
    }
    if (members <= 1) deletableHouseholds.push(householdId);
  }

  // Fotos der zu löschenden Haushalte vorher entfernen.
  if (deletableHouseholds.length > 0) {
    const [items, products, recipes] = await Promise.all([
      supabase
        .from("kitchen_items")
        .select("photo_path")
        .in("household_id", deletableHouseholds),
      supabase
        .from("kitchen_products")
        .select("photo_path")
        .in("household_id", deletableHouseholds),
      supabase
        .from("kitchen_recipes")
        .select("photo_path")
        .in("household_id", deletableHouseholds),
    ]);

    const photoPaths = [
      ...(items.data ?? []),
      ...(products.data ?? []),
      ...(recipes.data ?? []),
    ]
      .map((row) => row.photo_path)
      .filter((path): path is string => Boolean(path));

    if (photoPaths.length > 0) {
      await supabase.storage.from("product-photos").remove(photoPaths);
    }

    const { error: householdError } = await supabase
      .from("households")
      .delete()
      .in("id", deletableHouseholds);
    if (householdError) {
      return { ok: false, message: householdError.message };
    }
  }

  // Verbleibende Mitgliedschaften lösen sich beim Löschen des Users mit auf.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?deleted=1");
}
