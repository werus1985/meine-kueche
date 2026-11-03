import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { Alert } from "@/components/ui";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Anmelden",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const errorMessage =
    params.error === "bestätigung-fehlgeschlagen"
      ? "Die Bestätigung ist fehlgeschlagen oder ist abgelaufen. Bitte erneut anmelden oder registrieren."
      : params.error;

  return (
    <AuthShell
      title="Willkommen zurück"
      description="Melde dich an, um Vorräte und Einkaufsliste zu sehen."
      footer={
        <>
          Noch kein Konto? Die Registrierung ist nur per Einladung möglich.
        </>
      }
    >
      {errorMessage ? (
        <div className="mb-4">
          <Alert tone="error">{errorMessage}</Alert>
        </div>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
