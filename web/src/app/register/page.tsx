import Link from "next/link";
import type { Metadata } from "next";
import { MailX } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Registrieren",
};

type InviteInfo = {
  email: string;
  household_name: string;
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const token = (params.invite ?? "").trim();

  let invite: InviteInfo | null = null;
  if (token) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invite_signup", {
      p_token: token,
    });
    invite = ((data ?? []) as InviteInfo[])[0] ?? null;
  }

  // Ohne gültige Einladung gibt es kein Registrierungsformular.
  if (!invite) {
    return (
      <AuthShell
        title="Registrierung nur per Einladung"
        description="Diese App gehört zu einem geschlossenen Haushalt."
        footer={
          <>
            Schon registriert?{" "}
            <Link
              href="/login"
              className="font-medium text-emerald-700 hover:underline"
            >
              Zur Anmeldung
            </Link>
          </>
        }
      >
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
            <MailX className="size-4 text-red-600" /> Kein gültiger
            Einladungslink
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Öffne den Link aus deiner Einladungs-E-Mail. Einladungen laufen nach
            einiger Zeit ab – bei Problemen bitte um eine neue bitten.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Ein Konto ohne Einladung kann derzeit nicht angelegt werden.
          </p>
        </div>
      </AuthShell>
    );
  }

  const next = `/invite/${encodeURIComponent(token)}`;

  return (
    <AuthShell
      title="Konto anlegen"
      description={`Einladung für „${invite.household_name}“`}
      footer={
        <>
          Schon registriert?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            Zur Anmeldung
          </Link>
        </>
      }
    >
      <RegisterForm next={next} inviteToken={token} email={invite.email} />
    </AuthShell>
  );
}
