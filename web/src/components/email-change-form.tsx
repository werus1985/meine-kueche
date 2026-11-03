"use client";

import { useActionState } from "react";
import { AtSign } from "lucide-react";

import { changeEmailAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonSecondary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(changeEmailAction, null);

  return (
    <Card>
      <CardHeader
        title="E-Mail-Adresse"
        description="Änderungen werden erst nach der Bestätigung per E-Mail wirksam."
      />
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-stone-600">
          Aktuell:{" "}
          <span className="font-medium text-stone-900">
            {currentEmail || "–"}
          </span>
        </p>

        <FormMessage state={state} />

        <form action={formAction} className="space-y-2">
          <div>
            <Label htmlFor="new-email">Neue E-Mail-Adresse</Label>
            <input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="neu@beispiel.de"
              className={inputClass}
            />
          </div>
          <SubmitButton className={buttonSecondary}>
            <AtSign className="size-4" /> Änderung anfordern
          </SubmitButton>
        </form>

        <p className="text-xs text-stone-500">
          Du erhältst einen Bestätigungslink. Bis dahin bleibt die bisherige
          Adresse aktiv.
        </p>
      </div>
    </Card>
  );
}
