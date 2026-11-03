import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { RecipeDetail } from "@/components/recipe-detail";
import { buttonGhost } from "@/components/ui";
import { getRecipe, requireHousehold } from "@/lib/data";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { active }] = await Promise.all([params, requireHousehold()]);
  const recipe = await getRecipe(active.id, id);
  if (!recipe) notFound();

  return (
    <div>
      <div className="mb-3">
        <Link href="/recipes" className={buttonGhost}>
          <ArrowLeft className="size-4" /> Alle Rezepte
        </Link>
      </div>
      <RecipeDetail recipe={recipe} canWrite={active.canWrite} />
    </div>
  );
}
