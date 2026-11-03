"use client";

import { useActionState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";

import {
  createCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
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

export type CategoryRow = {
  id: string;
  name: string;
  itemCount: number;
};

function CategoryEditRow({ category }: { category: CategoryRow }) {
  const [state, formAction] = useActionState(renameCategoryAction, null);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={formAction}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={category.id} />
          <div className="min-w-0 flex-1">
            <input
              name="name"
              defaultValue={category.name}
              maxLength={80}
              className={inputClass}
              aria-label={`Kategorie ${category.name} umbenennen`}
            />
          </div>
          <SubmitButton className={buttonGhost} pendingLabel="Speichert …">
            <Save className="size-3.5" /> Speichern
          </SubmitButton>
        </form>
        <span className="w-20 text-right text-xs text-stone-500">
          {category.itemCount} Artikel
        </span>
        <form action={deleteCategoryAction}>
          <input type="hidden" name="id" value={category.id} />
          <ConfirmSubmitButton
            message={`Kategorie „${category.name}“ löschen? Alle Artikel werden nach „Allgemein“ verschoben.`}
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

export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: CategoryRow[];
  canWrite: boolean;
}) {
  const [state, formAction] = useActionState(createCategoryAction, null);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card>
          <CardHeader
            title="Kategorie anlegen"
            description="Kategorien gelten für den ganzen Haushalt."
          />
          <form action={formAction} className="space-y-3 px-5 py-4">
            <FormMessage state={state} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="category-name">Name</Label>
                <input
                  id="category-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="z. B. Molkerei"
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
          title="Kategorien"
          description={`${categories.length} ${categories.length === 1 ? "Kategorie" : "Kategorien"} in diesem Haushalt.`}
        />
        {categories.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            Noch keine Kategorien vorhanden.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {categories.map((category) =>
              canWrite ? (
                <CategoryEditRow key={category.id} category={category} />
              ) : (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-stone-800">
                    <Pencil className="size-3.5 text-stone-300" />
                    {category.name}
                  </span>
                  <span className="text-xs text-stone-500">
                    {category.itemCount} Artikel
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
        <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          Beim Löschen werden alle Artikel der Kategorie nach „Allgemein“
          verschoben. „Allgemein“ selbst kann nicht gelöscht werden.
        </div>
      </Card>

      {!canWrite ? (
        <p className="text-sm text-stone-500">
          Du hast nur Leserechte und kannst Kategorien nicht bearbeiten.
        </p>
      ) : null}
    </div>
  );
}
