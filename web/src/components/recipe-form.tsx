"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ImagePlus, Plus, Save, Trash2, X } from "lucide-react";

import { saveRecipeAction } from "@/actions/recipes";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  buttonSecondary,
  Card,
  CardHeader,
  inputClass,
  Label,
  textareaClass,
} from "@/components/ui";
import { compressImageFile, replaceFileInput } from "@/lib/image";
import type { RecipeIngredient, RecipeStep } from "@/lib/types";

type IngredientRow = {
  qty: string;
  unit: string;
  name: string;
  optional: boolean;
};

export type RecipeFormValue = {
  id?: string;
  title: string;
  description: string;
  servings: number;
  sourceUrl: string | null;
  photoUrl: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export function RecipeForm({
  mode,
  initial,
  canWrite = true,
}: {
  mode: "create" | "edit";
  initial?: RecipeFormValue;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(saveRecipeAction, null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initial?.ingredients.length
      ? initial.ingredients.map((entry) => ({
          qty: entry.qty === null ? "" : String(entry.qty),
          unit: entry.unit ?? "",
          name: entry.name,
          optional: entry.optional,
        }))
      : [{ qty: "", unit: "", name: "", optional: false }],
  );
  const [steps, setSteps] = useState<string[]>(() =>
    initial?.steps.length ? initial.steps.map((entry) => entry.text) : [""],
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial?.photoUrl ?? null,
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function updateStep(index: number, text: string) {
    setSteps((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? text : entry)),
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(
          ingredients.map((entry) => ({
            name: entry.name.trim(),
            qty: entry.qty,
            unit: entry.unit.trim() || null,
            optional: entry.optional,
          })),
        )}
      />
      <input
        type="hidden"
        name="steps"
        value={JSON.stringify(steps.map((entry) => entry.trim()))}
      />

      <Card className="p-4 sm:p-5">
        <CardHeader
          title={mode === "create" ? "Neues Rezept" : "Rezept bearbeiten"}
          description="Titel, Portionen und Zutaten – alles bleibt im Haushalt."
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="recipe-title">Titel</Label>
            <input
              id="recipe-title"
              name="title"
              required
              maxLength={200}
              defaultValue={initial?.title ?? ""}
              placeholder="z. B. Omas Apfelkuchen"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="recipe-servings" hint="Basis-Portionen">
              Portionen
            </Label>
            <input
              id="recipe-servings"
              name="servings"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={initial?.servings ?? 4}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="recipe-source" hint="optional">
              Rezept-Link
            </Label>
            <input
              id="recipe-source"
              name="source_url"
              type="url"
              defaultValue={initial?.sourceUrl ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="recipe-description" hint="optional">
              Beschreibung
            </Label>
            <textarea
              id="recipe-description"
              name="description"
              rows={2}
              maxLength={2000}
              defaultValue={initial?.description ?? ""}
              placeholder="Worum geht es, was macht das Rezept besonders?"
              className={textareaClass}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Zutaten"
          description="Mengen werden in der Anzeige automatisch auf die gewählte Portionszahl umgerechnet."
        />
        <div className="mt-3 space-y-2">
          {ingredients.map((entry, index) => (
            <div
              key={index}
              className="grid grid-cols-[4.5rem_5rem_1fr_auto] items-center gap-2"
            >
              <input
                value={entry.qty}
                onChange={(event) =>
                  updateIngredient(index, { qty: event.target.value })
                }
                inputMode="decimal"
                placeholder="Menge"
                aria-label={`Menge Zutat ${index + 1}`}
                className={inputClass}
              />
              <input
                value={entry.unit}
                onChange={(event) =>
                  updateIngredient(index, { unit: event.target.value })
                }
                placeholder="Einheit"
                aria-label={`Einheit Zutat ${index + 1}`}
                className={inputClass}
              />
              <input
                value={entry.name}
                onChange={(event) =>
                  updateIngredient(index, { name: event.target.value })
                }
                placeholder="Zutat"
                aria-label={`Name Zutat ${index + 1}`}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setIngredients((current) =>
                    current.length > 1
                      ? current.filter((_, entryIndex) => entryIndex !== index)
                      : current,
                  )
                }
                aria-label={`Zutat ${index + 1} entfernen`}
                title="Zutat entfernen"
                className="inline-flex size-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="size-4" />
              </button>
              <label className="col-span-4 flex items-center gap-2 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={entry.optional}
                  onChange={(event) =>
                    updateIngredient(index, { optional: event.target.checked })
                  }
                  className="size-3.5 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
                />
                optional
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setIngredients((current) => [
                ...current,
                { qty: "", unit: "", name: "", optional: false },
              ])
            }
            className={buttonSecondary}
          >
            <Plus className="size-4" /> Zutat
          </button>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <CardHeader title="Zubereitung" description="Ein Schritt pro Feld." />
        <div className="mt-3 space-y-2">
          {steps.map((entry, index) => (
            <div key={index} className="flex items-start gap-2">
              <textarea
                value={entry}
                onChange={(event) => updateStep(index, event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={`Schritt ${index + 1}`}
                aria-label={`Schritt ${index + 1}`}
                className={textareaClass}
              />
              <button
                type="button"
                onClick={() =>
                  setSteps((current) =>
                    current.length > 1
                      ? current.filter((_, entryIndex) => entryIndex !== index)
                      : current,
                  )
                }
                aria-label={`Schritt ${index + 1} entfernen`}
                title="Schritt entfernen"
                className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSteps((current) => [...current, ""])}
            className={buttonSecondary}
          >
            <Plus className="size-4" /> Schritt
          </button>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <Label htmlFor="recipe-photo" hint="max. 5 MB">
          Foto
        </Label>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="Rezeptfoto auswählen"
            title="Rezeptfoto auswählen"
            className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-400 transition hover:bg-stone-200"
          >
            {photoPreview && !removePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <input
              ref={photoInputRef}
              id="recipe-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setRemovePhoto(false);
                const compressed = await compressImageFile(file);
                if (compressed !== file) replaceFileInput(input, compressed);
                setPhotoPreview(URL.createObjectURL(compressed));
              }}
              className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100"
            />
            {initial?.photoUrl ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  name="removePhoto"
                  value="1"
                  checked={removePhoto}
                  onChange={(event) => setRemovePhoto(event.target.checked)}
                  className="size-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                />
                Vorhandenes Foto entfernen
              </label>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <SubmitButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60" disabled={!canWrite}>
          <Save className="size-4" />
          {mode === "create" ? "Rezept speichern" : "Änderungen speichern"}
        </SubmitButton>
        <Link href="/recipes" className={buttonSecondary}>
          <X className="size-4" /> Abbrechen
        </Link>
      </div>
    </form>
  );
}
