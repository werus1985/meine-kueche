import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock, MailX, UserPlus } from "lucide-react";

import { acceptInviteAction } from "@/actions/members";
import { AuthShell } from "@/components/auth-shell";
import { Alert, buttonPrimary, buttonSecondary } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/types";
import { roleDescription, roleLabel } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Einladung annehmen",
};

type SearchParams = {
  error?: string;
};

type InviteRow = {
  household_id?: string;
  household_name: string;
  email: string;
  role?: string;
  expires_at: string;
  accepted_at: string | null;
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const supabase = await createClient();

  // Ohne Anmeldung prüft die öffentliche Funktion nur, ob die Einladung gilt.
  const { data, error } = user
    ? await supabase.rpc("get_household_invite", { p_token: token })
    : await supabase.rpc("get_invite_signup", { p_token: token });

  const invite = ((data ?? []) as InviteRow[])[0] ?? null;
  const expired = invite ? new Date(invite.expires_at) < new Date() : false;
  const accepted = Boolean(invite?.accepted_at);
  const registerHref = `/register?invite=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <AuthShell
      title="Einladung"
      description={
        !user
          ? "Melde dich an oder lege ein Konto an, um die Einladung anzunehmen."
          : invite
            ? `Du wurdest in den Haushalt „${invite.household_name}“ eingeladen.`
            : "Diese Einladung konnte nicht gefunden werden."
      }
      footer={
        <Link
          href={user ? "/" : loginHref}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          {user ? "Zur Startseite" : "Zur Anmeldung"}
        </Link>
      }
    >
      <div className="space-y-4">
        {query.error ? <Alert tone="error">{query.error}</Alert> : null}
        {error ? <Alert tone="error">{error.message}</Alert> : null}

        {!user ? (
          invite ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                <UserPlus className="size-4 text-emerald-700" />
                {invite.household_name}
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Einladung für{" "}
                <span className="font-medium">{invite.email}</span>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Lege ein Konto mit dieser Adresse an oder melde dich an, falls du
                schon eines hast.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={registerHref} className={buttonPrimary}>
                  <UserPlus className="size-4" /> Konto erstellen
                </Link>
                <Link href={loginHref} className={buttonSecondary}>
                  Anmelden
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                <MailX className="size-4 text-red-600" /> Einladung nicht gültig
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Die Einladung ist abgelaufen oder wurde zurückgezogen. Bitte um
                eine neue Einladung.
              </p>
            </div>
          )
        ) : !invite ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
              <MailX className="size-4 text-red-600" /> Einladung nicht gültig
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Die Einladung ist abgelaufen, wurde zurückgezogen oder gilt für
              eine andere E-Mail-Adresse. Du bist aktuell als{" "}
              <span className="font-medium">{user.email}</span> angemeldet.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Melde dich mit der eingeladenen E-Mail-Adresse an oder bitte um
              eine neue Einladung.
            </p>
          </div>
        ) : accepted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="size-4" /> Einladung bereits angenommen
            </p>
            <p className="mt-2 text-sm text-emerald-800">
              Du bist bereits Mitglied in „{invite.household_name}“.
            </p>
            <Link href="/" className={`${buttonPrimary} mt-4`}>
              Zum Haushalt
            </Link>
          </div>
        ) : expired ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <Clock className="size-4" /> Einladung abgelaufen
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Bitte bitte um eine neue Einladung für „{invite.household_name}“.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
              <UserPlus className="size-4 text-emerald-700" />
              {invite.household_name}
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Rolle:{" "}
              <span className="font-medium">
                {roleLabel(invite.role as RoleKey)}
              </span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {roleDescription(invite.role ?? "")}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Einladung für {invite.email}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={acceptInviteAction}>
                <input type="hidden" name="token" value={token} />
                <button type="submit" className={buttonPrimary}>
                  <CheckCircle2 className="size-4" /> Einladung annehmen
                </button>
              </form>
              <Link href="/" className={buttonSecondary}>
                Später
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
