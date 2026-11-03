import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Registrieren",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <AuthShell
      title="Konto anlegen"
      description="Erstelle ein Konto und richte danach deinen Haushalt ein."
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
      <RegisterForm next={next} />
    </AuthShell>
  );
}
