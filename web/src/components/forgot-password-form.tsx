"use client";

import { useActionState } from "react";
import { MailQuestion } from "lucide-react";

import { requestPasswordResetAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, inputClass, Label } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@beispiel.de"
          className={inputClass}
        />
      </div>
      <SubmitButton
        className={`${buttonPrimary} w-full`}
        pendingLabel="Wird gesendet …"
      >
        <MailQuestion className="size-4" /> Link zusenden
      </SubmitButton>
    </form>
  );
}
