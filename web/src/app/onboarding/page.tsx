import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireUser } from "@/lib/auth";
import { getHouseholds } from "@/lib/data";

export const metadata: Metadata = {
  title: "Haushalt einrichten",
};

export default async function OnboardingPage() {
  await requireUser();
  const households = await getHouseholds();

  if (households.length > 0) redirect("/");

  return (
    <AuthShell
      title="Haushalt einrichten"
      description="Lege deinen ersten Haushalt an. Weitere Personen kannst du anschließend per E-Mail einladen."
      footer={
        <div className="flex flex-col gap-3">
          <p>
            Du wurdest in einen Haushalt eingeladen? Öffne einfach den
            Einladungslink aus der E-Mail.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800"
            >
              <LogOut className="size-4" /> Abmelden
            </button>
          </form>
          <Link href="/" className="text-xs text-stone-400 hover:text-stone-600">
            Zur Startseite
          </Link>
        </div>
      }
    >
      <OnboardingForm />
    </AuthShell>
  );
}
