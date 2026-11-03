"use client";

import { useActionState } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";

import {
  removeUserGeminiKeyAction,
  saveUserGeminiKeyAction,
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

export function AiKeyForm({
  hasPersonalKey,
  hasHouseholdKey,
}: {
  hasPersonalKey: boolean;
  hasHouseholdKey: boolean;
}) {
  const [state, formAction] = useActionState(saveUserGeminiKeyAction, null);

  return (
    <Card>
      <CardHeader
        title="KI (Gemini)"
        description="Eigener API-Key für die KI-Küche. Er bleibt privat – nur du kannst ihn lesen und nutzen."
      />
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-stone-700">
          Status:{" "}
          {hasPersonalKey ? (
            <Badge tone="green">Eigener Key hinterlegt</Badge>
          ) : hasHouseholdKey ? (
            <Badge tone="amber">Gemeinsamer Haushalts-Key aktiv</Badge>
          ) : (
            <Badge tone="red">Kein Key – KI nicht nutzbar</Badge>
          )}
        </p>

        <FormMessage state={state} />

        <form action={formAction} className="space-y-2">
          <div>
            <Label
              htmlFor="gemini-key"
              hint={hasPersonalKey ? "überschreibt den gespeicherten Key" : undefined}
            >
              Gemini-API-Key
            </Label>
            <input
              id="gemini-key"
              name="gemini_api_key"
              type="password"
              autoComplete="off"
              placeholder={hasPersonalKey ? "•••••••• (gespeichert)" : "API-Key"}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-stone-500">
              Key erstellen bei{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-800 hover:underline"
              >
                Google AI Studio
              </a>
              . Der Key wird nur serverseitig verwendet.
            </p>
          </div>
          <SubmitButton className={buttonPrimary}>
            <Save className="size-4" /> Key speichern
          </SubmitButton>
        </form>

        {hasPersonalKey ? (
          <form action={removeUserGeminiKeyAction}>
            <button type="submit" className={buttonDanger}>
              <Trash2 className="size-4" /> Eigenen Key entfernen
            </button>
          </form>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-stone-500">
          <KeyRound className="size-3.5" />
          Fehlt dein eigener Key, wird der gemeinsame Haushalts-Key genutzt –
          falls vorhanden.
        </p>
      </div>
    </Card>
  );
}
