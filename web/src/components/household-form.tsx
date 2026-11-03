"use client";

import { useActionState } from "react";
import { Save, Trash2 } from "lucide-react";

import {
  deleteHouseholdAction,
  renameHouseholdAction,
} from "@/actions/household";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonDanger,
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export function HouseholdForm({
  name,
  externalLookupEnabled,
  canManage,
}: {
  name: string;
  externalLookupEnabled: boolean;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(renameHouseholdAction, null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Haushaltsname"
          description="Der Name erscheint in der Navigation und bei allen Mitgliedern."
        />
        <form action={formAction} className="space-y-3 px-5 py-4">
          <FormMessage state={state} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor="household-name">Name</Label>
              <input
                id="household-name"
                name="name"
                required
                maxLength={80}
                defaultValue={name}
                disabled={!canManage}
                className={inputClass}
              />
            </div>
            {canManage ? (
              <SubmitButton className={buttonPrimary}>
                <Save className="size-4" /> Speichern
              </SubmitButton>
            ) : null}
          </div>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="externalLookup"
              defaultChecked={externalLookupEnabled}
              disabled={!canManage}
              className="mt-0.5 size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
            />
            <span>
              Externe Produktdatenbank nutzen
              <span className="mt-0.5 block text-xs text-stone-500">
                Unbekannte Barcodes fragen Open Food Facts nach Name, Kategorie,
                Einheit und Foto. Bekannte Produkte werden nie extern gesucht.
              </span>
            </span>
          </label>
          {!canManage ? (
            <p className="text-xs text-stone-500">
              Nur Eigentümer dürfen den Haushalt umbenennen.
            </p>
          ) : null}
        </form>
      </Card>

      {canManage ? (
        <Card className="border-red-200">
          <CardHeader
            title="Haushalt löschen"
            description="Alle Artikel, Einstellungen und Mitgliedschaften dieses Haushalts werden dauerhaft gelöscht."
          />
          <form action={deleteHouseholdAction} className="px-5 py-4">
            <ConfirmSubmitButton
              message="Diesen Haushalt endgültig löschen? Alle Daten gehen verloren."
              className={buttonDanger}
            >
              <Trash2 className="size-4" /> Haushalt löschen
            </ConfirmSubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
