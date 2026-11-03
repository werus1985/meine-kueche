import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Passwort vergessen"
      description="Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst."
      footer={
        <>
          Wieder eingefallen?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-700 hover:underline"
          >
            Zur Anmeldung
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
