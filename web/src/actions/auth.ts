"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import { safeNextPath } from "@/lib/utils";

function translateAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "E-Mail-Adresse oder Passwort ist falsch.";
  }
  if (lower.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }
  if (lower.includes("user already registered")) {
    return "Für diese E-Mail-Adresse gibt es bereits ein Konto.";
  }
  if (lower.includes("password should be at least")) {
    return "Das Passwort ist zu kurz. Bitte mindestens 8 Zeichen verwenden.";
  }
  if (lower.includes("rate limit")) {
    return "Zu viele Versuche. Bitte kurz warten und erneut probieren.";
  }
  return message;
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !password) {
    return { ok: false, message: "Bitte E-Mail-Adresse und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: translateAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");
  const inviteToken = String(formData.get("invite") ?? "").trim();

  if (!email || !password) {
    return { ok: false, message: "Bitte E-Mail-Adresse und Passwort eingeben." };
  }
  if (password.length < 8) {
    return {
      ok: false,
      message: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    };
  }
  if (password !== passwordRepeat) {
    return { ok: false, message: "Die Passwörter stimmen nicht überein." };
  }

  const supabase = await createClient();

  // Registrierung nur mit gültiger, offener Einladung für genau diese Adresse.
  const { data: inviteData } = inviteToken
    ? await supabase.rpc("get_invite_signup", { p_token: inviteToken })
    : { data: null };
  const invite = ((inviteData ?? []) as { email: string }[])[0] ?? null;
  if (!invite) {
    return {
      ok: false,
      message:
        "Die Registrierung ist nur per Einladung möglich. Bitte öffne den Link aus deiner Einladungs-E-Mail.",
    };
  }
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    return {
      ok: false,
      message: "Diese Einladung gilt für eine andere E-Mail-Adresse.",
    };
  }

  // Feste Site-URL statt Request-Origin: der Origin-Header ist fälschbar.
  const origin = SITE_URL;
  // Nach der Bestätigung direkt zur Einladung – dort wird sie angenommen.
  const next = `/invite/${encodeURIComponent(inviteToken)}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { ok: false, message: translateAuthError(error.message) };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    ok: true,
    message:
      "Konto angelegt. Bitte bestätige jetzt deine E-Mail-Adresse über den Link in der E-Mail.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
