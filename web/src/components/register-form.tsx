"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { signUpAction } from "@/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, inputClass, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export function RegisterForm({
  next,
  inviteToken,
  email,
}: {
  next: string;
  inviteToken: string;
  /** Adresse aus der Einladung – fest vorgegeben. */
  email: string;
}) {
  const [state, formAction] = useActionState(signUpAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="invite" value={inviteToken} />
      <div>
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly
          defaultValue={email}
          aria-readonly="true"
          className={cn(inputClass, "bg-stone-100 text-stone-600")}
        />
        <p className="mt-1 text-[11px] text-stone-500">
          Die Einladung gilt für diese Adresse.
        </p>
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
