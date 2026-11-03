"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Minus, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteRecipeAction } from "@/actions/recipes";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { Badge, Card } from "@/components/ui";
import type { RecipeWithDetails } from "@/lib/types";
import { formatQty } from "@/lib/utils";

const SOURCE_LABELS: Record<RecipeWithDetails["source"], string> = {
  manual: "Eigenes Rezept",
  chat: "Aus dem Chat",
  link: "Aus Link",
  photo: "Aus Foto",
};

export function RecipeDetail({
  recipe,
  canWrite,
}: {
  recipe: RecipeWithDetails;
  canWrite: boolean;
}) {
  const [persons, setPersons] = useState(recipe.servings);
  const factor = persons / recipe.servings;

  function scaled(qty: number | null) {
    if (qty === null) return null;
    return Math.round(qty * factor * 100) / 100;
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        {recipe.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.photoUrl}
            alt=""
            className="h-44 w-full object-cover sm:h-56"
          />
        ) : null}

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                {recipe.title}
              </h1>
              {recipe.description ? (
                <p className="mt-1 max-w-2xl text-sm text-stone-600">
                  {recipe.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Badge tone="neutral">{SOURCE_LABELS[recipe.source]}</Badge>
                <span>
                  Basis: {recipe.servings}{" "}
                  {recipe.servings === 1 ? "Portion" : "Portionen"}
                </span>
                {recipe.source_url ? (
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline"
                  >
                    Original <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>

            {canWrite ? (
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/recipes/${recipe.id}/edit`}
                  aria-label="Rezept bearbeiten"
                  title="Bearbeiten"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                >
                  <Pencil className="size-4" />
                </Link>
                <form action={deleteRecipeAction}>
                  <input type="hidden" name="id" value={recipe.id} />
                  <ConfirmSubmitButton
                    message={`„${recipe.title}“ wirklich löschen?`}
                    ariaLabel="Rezept löschen"
                    title="Löschen"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-medium text-stone-700">
              Für wie viele Portionen?
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPersons((current) => Math.max(1, current - 1))}
                disabled={persons <= 1}
                aria-label="Weniger Portionen"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-100 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-10 text-center text-sm font-semibold tabular-nums text-stone-900">
                {persons}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPersons((current) => Math.min(100, current + 1))
                }
                disabled={persons >= 100}
                aria-label="Mehr Portionen"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-100 disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
              {persons !== recipe.servings ? (
                <button
                  type="button"
                  onClick={() => setPersons(recipe.servings)}
                  className="ml-1 text-xs font-medium text-stone-500 underline"
                >
                  zurücksetzen
                </button>
              ) : null}
            </div>
          </div>

          <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Zutaten
          </h2>
          {recipe.ingredients.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500">Keine Zutaten hinterlegt.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-stone-700">
              {recipe.ingredients.map((ingredient, index) => {
                const quantity = scaled(ingredient.qty);
                return (
                  <li key={index} className="flex min-w-0 items-baseline gap-2">
                    <span className="w-14 shrink-0 text-right font-medium tabular-nums text-stone-900">
                      {quantity === null ? "" : formatQty(quantity)}
                    </span>
                    {ingredient.unit ? (
                      <span className="shrink-0 text-stone-500">
                        {ingredient.unit}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      {ingredient.name}
                      {ingredient.optional ? (
                        <span className="text-stone-400"> (optional)</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {recipe.steps.length > 0 ? (
            <>
              <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Zubereitung
              </h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-700">
                {recipe.steps.map((step, index) => (
                  <li key={index}>{step.text}</li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
