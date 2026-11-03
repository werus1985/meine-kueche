import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/reset-password-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Neues Passwort",
};

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password?expired=1");

  return (
    <AuthShell
      title="Neues Passwort"
      description={`Neues Passwort für ${user.email ?? "dein Konto"} festlegen.`}
      footer={
        <Link
          href="/items"
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          Abbrechen
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
