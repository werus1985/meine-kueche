"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { updatePasswordAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, buttonSecondary, inputClass, Label } from "@/components/ui";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="password" hint="mind. 8 Zeichen">
          Neues Passwort
        </Label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="passwordRepeat">Passwort wiederholen</Label>
        <input
          id="passwordRepeat"
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>
      <SubmitButton
        className={`${buttonPrimary} w-full`}
        pendingLabel="Wird gespeichert …"
      >
        <KeyRound className="size-4" /> Passwort speichern
      </SubmitButton>
      {state?.ok ? (
        <Link href="/items" className={`${buttonSecondary} w-full`}>
          Weiter zur App
        </Link>
      ) : null}
    </form>
  );
}
