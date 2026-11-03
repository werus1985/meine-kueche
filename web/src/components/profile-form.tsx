"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import { saveProfileAction } from "@/actions/settings";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export function ProfileForm({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const [state, formAction] = useActionState(saveProfileAction, null);

  return (
    <Card>
      <CardHeader
        title="Profil"
        description="Der Anzeigename wird anderen Haushaltsmitgliedern angezeigt."
      />
      <form action={formAction} className="space-y-3 px-5 py-4">
        <FormMessage state={state} />
        <div>
          <Label htmlFor="display_name">Anzeigename</Label>
          <input
            id="display_name"
            name="display_name"
            maxLength={80}
            defaultValue={displayName}
            placeholder="z. B. Fabian"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="profile-email">E-Mail-Adresse</Label>
          <input
            id="profile-email"
            value={email}
            readOnly
            disabled
            className={inputClass}
          />
          <p className="mt-1 text-xs text-stone-400">
            Die E-Mail-Adresse wird zur Anmeldung verwendet und kann hier nicht
            geändert werden.
          </p>
        </div>
        <SubmitButton className={buttonPrimary}>
          <Save className="size-4" /> Profil speichern
        </SubmitButton>
      </form>
    </Card>
  );
}
