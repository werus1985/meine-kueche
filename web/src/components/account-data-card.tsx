"use client";

import { useActionState } from "react";
import { Download, Trash2 } from "lucide-react";

import { deleteAccountAction } from "@/actions/account";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonDanger,
  buttonSecondary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export function AccountDataCard() {
  const [state, formAction] = useActionState(deleteAccountAction, null);

  return (
    <Card>
      <CardHeader
        title="Meine Daten"
        description="Exportiere deine Haushaltsdaten oder lösche dein Konto endgültig."
      />
      <div className="space-y-4 px-5 py-4">
        <div>
          <a href="/api/export" className={buttonSecondary}>
            <Download className="size-4" /> Daten exportieren (JSON)
          </a>
          <p className="mt-1 text-xs text-stone-500">
            Enthält Profil, Mitglieder und alle Daten des aktiven Haushalts –
            ohne KI-Keys.
          </p>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-900">Konto löschen</p>
          <p className="mt-1 text-xs text-stone-500">
            Löscht dein Konto, deine Mitgliedschaften und alle Haushalte, in
            denen du allein bist – inklusive Fotos. Das kann nicht rückgängig
            gemacht werden.
          </p>

          <FormMessage state={state} />

          <form action={formAction} className="mt-2 space-y-2">
            <div>
              <Label htmlFor="delete-confirmation" hint="Großbuchstaben">
                Zum Bestätigen „LÖSCHEN“ eingeben
              </Label>
              <input
                id="delete-confirmation"
                name="confirmation"
                autoComplete="off"
                placeholder="LÖSCHEN"
                className={inputClass}
              />
            </div>
            <SubmitButton
              className={buttonDanger}
              pendingLabel="Konto wird gelöscht …"
            >
              <Trash2 className="size-4" /> Konto endgültig löschen
            </SubmitButton>
          </form>
        </div>
      </div>
    </Card>
  );
}
