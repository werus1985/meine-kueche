"use client";

import { useActionState } from "react";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";

import {
  deleteQuickFilterAction,
  saveQuickFilterAction,
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

export type QuickFilterValue = {
  id: string;
  name: string;
  sort_order: number;
  categoryIds: string[];
};

function QuickFilterForm({
  categories,
  filter,
  compact = false,
}: {
  categories: { id: string; name: string }[];
  filter?: QuickFilterValue;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(saveQuickFilterAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      {filter ? <input type="hidden" name="id" value={filter.id} /> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor={filter ? `filter-name-${filter.id}` : "filter-name"}>
            Name
          </Label>
          <input
            id={filter ? `filter-name-${filter.id}` : "filter-name"}
            name="name"
            required
            maxLength={80}
            defaultValue={filter?.name ?? ""}
            placeholder="z. B. Frühstück"
            className={inputClass}
          />
        </div>
        <div className="w-24">
          <Label
            htmlFor={filter ? `filter-sort-${filter.id}` : "filter-sort"}
          >
            Sortierung
          </Label>
          <input
            id={filter ? `filter-sort-${filter.id}` : "filter-sort"}
            name="sort_order"
            type="number"
            defaultValue={filter?.sort_order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-700">
          Kategorien
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-emerald-300 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900"
            >
              <input
                type="checkbox"
                name="categoryIds"
                value={category.id}
                defaultChecked={filter?.categoryIds.includes(category.id)}
                className="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton className={compact ? buttonGhost : buttonPrimary}>
        {filter ? (
          <>
            <Save className="size-4" /> Speichern
          </>
        ) : (
          <>
            <Plus className="size-4" /> Schnellfilter anlegen
          </>
        )}
      </SubmitButton>
    </form>
  );
}

export function QuickFilterManager({
  categories,
  filters,
  canWrite,
}: {
  categories: { id: string; name: string }[];
  filters: QuickFilterValue[];
  canWrite: boolean;
}) {
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card>
          <CardHeader
            title="Schnellfilter anlegen"
            description="Ein Schnellfilter bündelt mehrere Kategorien, zum Beispiel für den Wocheneinkauf."
          />
          <div className="px-5 py-4">
            <QuickFilterForm categories={categories} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Schnellfilter"
          description={`${filters.length} ${filters.length === 1 ? "Filter" : "Filter"} in diesem Haushalt.`}
        />
        {filters.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            Noch keine Schnellfilter vorhanden.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filters.map((filter) => (
              <li key={filter.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Sparkles className="size-4 text-emerald-700" />
                      {filter.name}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {filter.categoryIds
                        .map((id) => categoryNames.get(id))
                        .filter(Boolean)
                        .join(", ") || "Keine Kategorien"}
                    </p>
                  </div>
                  <span className="text-xs text-stone-400">
                    Sortierung {filter.sort_order}
                  </span>
                </div>

                {canWrite ? (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800">
                        Bearbeiten
                      </summary>
                      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <QuickFilterForm
                          categories={categories}
                          filter={filter}
                          compact
                        />
                      </div>
                    </details>
                    <form action={deleteQuickFilterAction}>
                      <input type="hidden" name="id" value={filter.id} />
                      <ConfirmSubmitButton
                        message={`Schnellfilter „${filter.name}“ löschen?`}
                        className={buttonGhost}
                      >
                        <Trash2 className="size-3.5 text-red-600" /> Löschen
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          Schnellfilter gelten haushaltsweit und erscheinen auf der Übersicht
          und in der Artikelliste.
        </div>
      </Card>

      {!canWrite ? (
        <p className="text-sm text-stone-500">
          Du hast nur Leserechte und kannst Schnellfilter nicht bearbeiten.
        </p>
      ) : null}
    </div>
  );
}
