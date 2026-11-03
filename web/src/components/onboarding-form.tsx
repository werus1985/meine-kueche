"use client";

import { useActionState } from "react";
import { Home } from "lucide-react";

import { createHouseholdAction } from "@/actions/household";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, inputClass, Label } from "@/components/ui";

export function OnboardingForm() {
  const [state, formAction] = useActionState(createHouseholdAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="name">Name des Haushalts</Label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="z. B. Familie Fruchtl"
          className={inputClass}
          autoFocus
        />
      </div>
      <SubmitButton
        className={`${buttonPrimary} w-full`}
        pendingLabel="Haushalt wird angelegt …"
      >
        <Home className="size-4" /> Haushalt anlegen
      </SubmitButton>
    </form>
  );
}
