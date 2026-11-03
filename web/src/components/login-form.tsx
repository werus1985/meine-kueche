"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { signInAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, inputClass, Label } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, null);

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
        <Label htmlFor="password">Passwort</Label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <SubmitButton
        className={`${buttonPrimary} w-full`}
        pendingLabel="Anmeldung läuft …"
      >
        <LogIn className="size-4" /> Anmelden
      </SubmitButton>
    </form>
  );
}
