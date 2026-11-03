"use client";

import { useActionState } from "react";
import { Save, Trash2 } from "lucide-react";

import {
  removeHouseholdGeminiKeyAction,
  saveHouseholdGeminiKeyAction,
} from "@/actions/settings";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  buttonDanger,
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export function HouseholdAiKeyForm({
  hasKey,
  canManage,
}: {
  hasKey: boolean;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(saveHouseholdGeminiKeyAction, null);

  return (
    <Card>
      <CardHeader
        title="Gemeinsamer KI-Key"
        description="Optional für Mitglieder ohne eigenen Key. Alle Mitglieder können diesen Key nutzen."
      />
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-stone-700">
          Status:{" "}
          {hasKey ? (
            <Badge tone="green">Haushalts-Key hinterlegt</Badge>
          ) : (
            <Badge tone="neutral">Kein gemeinsamer Key</Badge>
          )}
        </p>

        <FormMessage state={state} />

        {canManage ? (
          <>
            <form action={formAction} className="space-y-2">
              <div>
                <Label
                  htmlFor="household-gemini-key"
                  hint={hasKey ? "überschreibt den gespeicherten Key" : undefined}
                >
                  Gemini-API-Key
                </Label>
                <input
                  id="household-gemini-key"
                  name="gemini_api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={hasKey ? "•••••••• (gespeichert)" : "API-Key"}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-stone-500">
                  Hinweis: Ein gemeinsamer Key ist für alle Mitglieder technisch
                  einsehbar. Persönliche Keys bleiben privat.
                </p>
              </div>
              <SubmitButton className={buttonPrimary}>
                <Save className="size-4" /> Key speichern
              </SubmitButton>
            </form>

            {hasKey ? (
              <form action={removeHouseholdGeminiKeyAction}>
                <button type="submit" className={buttonDanger}>
                  <Trash2 className="size-4" /> Gemeinsamen Key entfernen
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-stone-500">
            Nur Eigentümer können den gemeinsamen Key ändern.
          </p>
        )}
      </div>
    </Card>
  );
}
