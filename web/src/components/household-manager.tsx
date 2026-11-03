"use client";

import { Check, Home, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import {
  createHouseholdAction,
  switchHousehold,
} from "@/actions/household";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  buttonGhost,
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";
import type { HouseholdSummary } from "@/lib/types";
import { cn, roleLabel } from "@/lib/utils";

export function HouseholdManager({
  households,
  activeId,
}: {
  households: HouseholdSummary[];
  activeId: string;
}) {
  const [state, formAction] = useActionState(createHouseholdAction, null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function switchTo(householdId: string) {
    if (householdId === activeId || pending) return;
    setPendingId(householdId);
    startTransition(async () => {
      await switchHousehold(householdId);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Deine Haushalte"
          description="Wechsle zwischen Haushalten oder lege einen neuen an. Vorräte und Einkaufslisten sind je Haushalt getrennt."
        />
        <ul className="divide-y divide-stone-100">
          {households.map((household) => (
            <li
              key={household.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  <Home className="size-4 text-emerald-700" />
                  <span className="truncate">{household.name}</span>
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {roleLabel(household.role)}
                </p>
              </div>
              {household.id === activeId ? (
                <Badge tone="green">
                  <Check className="size-3" /> Aktiv
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTo(household.id)}
                  disabled={pending}
                  className={cn(buttonGhost, "border border-stone-200")}
                >
                  {pendingId === household.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Wechseln
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Neuen Haushalt anlegen"
          description="Der neue Haushalt wird direkt geöffnet und ist nur für dich sichtbar, bis du Mitglieder einlädst."
        />
        <form action={formAction} className="space-y-3 px-5 py-4">
          <FormMessage state={state} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor="new-household-name">Name</Label>
              <input
                id="new-household-name"
                name="name"
                required
                maxLength={80}
                placeholder="z. B. Ferienwohnung"
                className={inputClass}
              />
            </div>
            <SubmitButton className={buttonPrimary}>
              <Plus className="size-4" /> Haushalt anlegen
            </SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
