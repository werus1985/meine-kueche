"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ACTIVE_HOUSEHOLD_COOKIE, getActiveHousehold } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const VALID_ROLES = new Set(["owner", "editor", "viewer"]);

export async function createInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canManageMembers) {
    return {
      ok: false,
      message: "Nur Eigentümer dürfen Mitglieder einladen.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  if (!VALID_ROLES.has(role)) {
    return { ok: false, message: "Ungültige Rolle." };
  }
  if (role === "owner" && !context.active.canManageHousehold) {
    return {
      ok: false,
      message: "Nur Eigentümer dürfen weitere Eigentümer ernennen.",
    };
  }

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_household_invite", {
    p_household_id: context.active.id,
    p_email: email,
    p_role: role,
  });

  if (error) return { ok: false, message: error.message };
  if (!token) {
    return { ok: false, message: "Die Einladung konnte nicht erstellt werden." };
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? SITE_URL;
  const inviteUrl = `${origin}/invite/${token}`;

  revalidatePath("/settings/members");
  return {
    ok: true,
    message: `Einladung für ${email} erstellt. Der Link ist 14 Tage gültig.`,
    inviteUrl,
  };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canManageMembers) {
    redirect("/settings/members?error=keine-berechtigung");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/members");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_household_invite", {
    p_invite_id: id,
  });

  revalidatePath("/settings/members");

  if (error) {
    redirect(`/settings/members?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/settings/members?revoked=1");
}

export async function setMemberRoleAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canManageMembers) {
    redirect("/settings/members?error=keine-berechtigung");
  }

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !VALID_ROLES.has(role)) redirect("/settings/members");

  if (role === "owner" && !context.active.canManageHousehold) {
    redirect("/settings/members?error=owner-rolle");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_household_id: context.active.id,
    p_user_id: userId,
    p_role: role,
  });

  revalidatePath("/", "layout");

  if (error) {
    redirect(`/settings/members?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/settings/members?saved=1");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect("/settings/members");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSelf = user?.id === userId;

  if (!isSelf && !context.active.canManageMembers) {
    redirect("/settings/members?error=keine-berechtigung");
  }

  const { error } = await supabase.rpc("remove_household_member", {
    p_household_id: context.active.id,
    p_user_id: userId,
  });

  revalidatePath("/", "layout");

  if (error) {
    redirect(`/settings/members?error=${encodeURIComponent(error.message)}`);
  }
  if (isSelf) {
    const store = await cookies();
    store.delete(ACTIVE_HOUSEHOLD_COOKIE);
    redirect("/");
  }
  redirect("/settings/members?removed=1");
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  const supabase = await createClient();
  const { data: householdId, error } = await supabase.rpc(
    "accept_household_invite",
    { p_token: token },
  );

  if (error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  }

  if (householdId) {
    const store = await cookies();
    store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  revalidatePath("/", "layout");
  redirect("/");
}
