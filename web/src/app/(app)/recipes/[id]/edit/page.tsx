import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { RecipeForm } from "@/components/recipe-form";
import { buttonGhost, PageHeader } from "@/components/ui";
import { getRecipe, requireHousehold } from "@/lib/data";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { active }] = await Promise.all([params, requireHousehold()]);
  const recipe = await getRecipe(active.id, id);
  if (!recipe) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Rezepte"
        title="Rezept bearbeiten"
        action={
          <Link href={`/recipes/${recipe.id}`} className={buttonGhost}>
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        }
      />
      <RecipeForm
        mode="edit"
        canWrite={active.canWrite}
        initial={{
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          sourceUrl: recipe.source_url,
          photoUrl: recipe.photoUrl ?? null,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }}
      />
    </div>
  );
}
