"use client";

import { useActionState } from "react";
import { Plus, Ruler, Save, Trash2 } from "lucide-react";

import {
  createUnitAction,
  deleteUnitAction,
  updateUnitAction,
} from "@/actions/settings";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonGhost,
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
} from "@/components/ui";

export type UnitRow = {
  id: string;
  name: string;
  step_size: number;
  itemCount: number;
};

function UnitEditRow({ unit }: { unit: UnitRow }) {
  const [state, formAction] = useActionState(updateUnitAction, null);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={formAction}
          className="flex min-w-48 flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={unit.id} />
          <input
            name="name"
            defaultValue={unit.name}
            maxLength={40}
            className={`${inputClass} min-w-40 flex-1`}
            aria-label={`Einheit ${unit.name} umbenennen`}
          />
          <div className="flex items-center gap-1">
            <input
              name="step_size"
              type="number"
              min="0.01"
              step="any"
              defaultValue={unit.step_size}
              className={`${inputClass} w-24`}
              aria-label={`Schrittgröße für ${unit.name}`}
              title="Schrittgröße"
            />
            <span className="text-xs text-stone-400">pro Schritt</span>
          </div>
          <SubmitButton className={buttonGhost} pendingLabel="Speichert …">
            <Save className="size-3.5" /> Speichern
          </SubmitButton>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-stone-500">
            {unit.itemCount} Artikel
          </span>
          <form action={deleteUnitAction}>
            <input type="hidden" name="id" value={unit.id} />
            <ConfirmSubmitButton
              message={`Einheit „${unit.name}“ löschen? Alle Artikel werden auf „Stück“ umgestellt.`}
              className={buttonGhost}
            >
              <Trash2 className="size-3.5 text-red-600" /> Löschen
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
      {state?.message ? (
        <p
          className={
            state.ok
              ? "mt-1 text-xs text-emerald-700"
              : "mt-1 text-xs text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

export function UnitManager({
  units,
  canWrite,
}: {
  units: UnitRow[];
  canWrite: boolean;
}) {
  const [state, formAction] = useActionState(createUnitAction, null);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card>
          <CardHeader
            title="Einheit anlegen"
            description="Die Schrittgröße bestimmt, um wie viel die Menge beim Plus/Minus erhöht wird – z. B. 0,5 bei kg oder 1 bei Stück."
          />
          <form action={formAction} className="space-y-3 px-5 py-4">
            <FormMessage state={state} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <Label htmlFor="unit-name">Name</Label>
                <input
                  id="unit-name"
                  name="name"
                  required
                  maxLength={40}
                  placeholder="z. B. Packung"
                  className={inputClass}
                />
              </div>
              <div className="w-28">
                <Label htmlFor="unit-step">Schrittgröße</Label>
                <input
                  id="unit-step"
                  name="step_size"
                  type="number"
                  min="0.01"
                  step="any"
                  defaultValue={1}
                  className={inputClass}
                />
              </div>
              <SubmitButton className={buttonPrimary}>
                <Plus className="size-4" /> Anlegen
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Einheiten"
          description={`${units.length} ${units.length === 1 ? "Einheit" : "Einheiten"} in diesem Haushalt.`}
        />
        {units.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            Noch keine Einheiten vorhanden.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {units.map((unit) =>
              canWrite ? (
                <UnitEditRow key={unit.id} unit={unit} />
              ) : (
                <li
                  key={unit.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-stone-800">
                    <Ruler className="size-3.5 text-stone-300" />
                    {unit.name}
                  </span>
                  <span className="text-xs text-stone-500">
                    Schritt {unit.step_size} · {unit.itemCount} Artikel
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
        <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          Beim Löschen werden alle Artikel auf „Stück“ umgestellt. „Stück“
          selbst kann nicht gelöscht werden.
        </div>
      </Card>

      {!canWrite ? (
        <p className="text-sm text-stone-500">
          Du hast nur Leserechte und kannst Einheiten nicht bearbeiten.
        </p>
      ) : null}
    </div>
  );
}
