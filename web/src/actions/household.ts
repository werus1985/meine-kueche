"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_HOUSEHOLD_COOKIE, getActiveHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

function setActiveHouseholdCookie(householdId: string) {
  return cookies().then((store) => {
    store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  });
}

export async function switchHousehold(householdId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return;

  await setActiveHouseholdCookie(householdId);
  revalidatePath("/", "layout");
}

export async function createHouseholdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) {
    return { ok: false, message: "Bitte einen Haushaltsnamen eingeben." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household", {
    p_name: name,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const household = Array.isArray(data) ? data[0] : data;
  if (!household?.id) {
    return {
      ok: false,
      message: "Der Haushalt konnte nicht angelegt werden.",
    };
  }

  await setActiveHouseholdCookie(household.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function renameHouseholdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canManageHousehold) {
    return {
      ok: false,
      message: "Nur Eigentümer dürfen den Haushalt umbenennen.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) {
    return { ok: false, message: "Bitte einen Haushaltsnamen eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      name,
      external_lookup_enabled: formData.get("externalLookup") === "on",
    })
    .eq("id", context.active.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Haushalt wurde gespeichert." };
}

export async function deleteHouseholdAction(): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canManageHousehold) {
    redirect("/settings/household?error=keine-berechtigung");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_household", {
    p_household_id: context.active.id,
  });

  if (error) {
    redirect(
      `/settings/household?error=${encodeURIComponent(error.message)}`,
    );
  }

  const store = await cookies();
  store.delete(ACTIVE_HOUSEHOLD_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
