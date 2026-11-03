import Link from "next/link";
import { BookOpenText, Plus } from "lucide-react";

import { Alert, Badge, buttonPrimary, Card, EmptyState, PageHeader } from "@/components/ui";
import { getRecipes, requireHousehold } from "@/lib/data";
import type { RecipeWithDetails } from "@/lib/types";

const SOURCE_LABELS: Record<RecipeWithDetails["source"], string> = {
  manual: "Eigenes Rezept",
  chat: "Aus dem Chat",
  link: "Aus Link",
  photo: "Aus Foto",
};

type SearchParams = { saved?: string; deleted?: string; error?: string };

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, { active }] = await Promise.all([searchParams, requireHousehold()]);
  const recipes = await getRecipes(active.id);

  return (
    <div>
      <PageHeader
        eyebrow="Rezepte"
        title="Lieblingsrezepte"
        description="Speichere Rezepte aus dem KI-Chat oder lege sie selbst an."
        action={
          <Link href="/recipes/new" className={buttonPrimary}>
            <Plus className="size-4" /> Rezept
          </Link>
        }
      />

      {params.saved ? (
        <div className="mb-3">
          <Alert tone="success">Rezept wurde gespeichert.</Alert>
        </div>
      ) : null}
      {params.deleted ? (
        <div className="mb-3">
          <Alert tone="success">Rezept wurde gelöscht.</Alert>
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-3">
          <Alert tone="error">
            {params.error === "keine-berechtigung"
              ? "Du hast in diesem Haushalt nur Leserechte."
              : params.error}
          </Alert>
        </div>
      ) : null}

      {recipes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenText className="size-5" />}
            title="Noch keine Rezepte"
            description="Speichere ein Rezept aus dem KI-Chat oder lege hier dein erstes eigenes Rezept an."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="group flex min-w-0 gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-400">
                {recipe.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.photoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <BookOpenText className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {recipe.title}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {recipe.servings}{" "}
                  {recipe.servings === 1 ? "Portion" : "Portionen"} ·{" "}
                  {recipe.ingredients.length} Zutaten
                </p>
                {recipe.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                    {recipe.description}
                  </p>
                ) : null}
                <div className="mt-1.5">
                  <Badge tone={recipe.source === "chat" ? "green" : "neutral"}>
                    {SOURCE_LABELS[recipe.source]}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
