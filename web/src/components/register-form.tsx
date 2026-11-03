"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { signUpAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, inputClass, Label } from "@/components/ui";

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signUpAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
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
      <div>
        <Label htmlFor="password" hint="mind. 8 Zeichen">
          Passwort
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
        pendingLabel="Konto wird angelegt …"
      >
        <UserPlus className="size-4" /> Konto anlegen
      </SubmitButton>
    </form>
  );
}
