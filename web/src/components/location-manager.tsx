"use client";

import { useActionState } from "react";
import { MapPin, Plus, Save, Trash2 } from "lucide-react";

import {
  createLocationAction,
  deleteLocationAction,
  renameLocationAction,
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

export type LocationRow = {
  id: string;
  name: string;
  sort_order: number;
  itemCount: number;
};

function LocationEditRow({ location }: { location: LocationRow }) {
  const [state, formAction] = useActionState(renameLocationAction, null);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={formAction}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={location.id} />
          <input
            name="name"
            defaultValue={location.name}
            maxLength={80}
            className={`${inputClass} min-w-40 flex-1`}
            aria-label={`Lagerort ${location.name} umbenennen`}
          />
          <input
            name="sort_order"
            type="number"
            defaultValue={location.sort_order}
            className={`${inputClass} w-20`}
            aria-label={`Sortierung für ${location.name}`}
            title="Sortierung"
          />
          <SubmitButton className={buttonGhost} pendingLabel="Speichert …">
            <Save className="size-3.5" /> Speichern
          </SubmitButton>
        </form>
        <span className="w-20 text-right text-xs text-stone-500">
          {location.itemCount} Artikel
        </span>
        <form action={deleteLocationAction}>
          <input type="hidden" name="id" value={location.id} />
          <ConfirmSubmitButton
            message={`Lagerort „${location.name}“ löschen? Alle Artikel werden nach „Sonstiges“ verschoben.`}
            className={buttonGhost}
          >
            <Trash2 className="size-3.5 text-red-600" /> Löschen
          </ConfirmSubmitButton>
        </form>
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

export function LocationManager({
  locations,
  canWrite,
}: {
  locations: LocationRow[];
  canWrite: boolean;
}) {
  const [state, formAction] = useActionState(createLocationAction, null);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card>
          <CardHeader
            title="Lagerort anlegen"
            description="Zum Beispiel Keller, Kühlschrank oder Gefrierschrank."
          />
          <form action={formAction} className="space-y-3 px-5 py-4">
            <FormMessage state={state} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="location-name">Name</Label>
                <input
                  id="location-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="z. B. Kühlschrank"
                  className={inputClass}
                />
              </div>
              <div className="w-24">
                <Label htmlFor="location-sort">Sortierung</Label>
                <input
                  id="location-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={0}
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
          title="Lagerorte"
          description={`${locations.length} ${locations.length === 1 ? "Lagerort" : "Lagerorte"} in diesem Haushalt.`}
        />
        {locations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            Noch keine Lagerorte vorhanden.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {locations.map((location) =>
              canWrite ? (
                <LocationEditRow key={location.id} location={location} />
              ) : (
                <li
                  key={location.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-stone-800">
                    <MapPin className="size-3.5 text-stone-300" />
                    {location.name}
                  </span>
                  <span className="text-xs text-stone-500">
                    {location.itemCount} Artikel
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
        <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          Beim Löschen werden alle Artikel nach „Sonstiges“ verschoben.
          „Sonstiges“ selbst kann nicht gelöscht werden.
        </div>
      </Card>

      {!canWrite ? (
        <p className="text-sm text-stone-500">
          Du hast nur Leserechte und kannst Lagerorte nicht bearbeiten.
        </p>
      ) : null}
    </div>
  );
}
