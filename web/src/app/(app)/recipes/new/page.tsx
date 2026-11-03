import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { RecipeForm } from "@/components/recipe-form";
import { buttonGhost, PageHeader } from "@/components/ui";
import { requireHousehold } from "@/lib/data";

export default async function NewRecipePage() {
  const { active } = await requireHousehold();

  return (
    <div>
      <PageHeader
        eyebrow="Rezepte"
        title="Neues Rezept"
        action={
          <Link href="/recipes" className={buttonGhost}>
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        }
      />

      {!active.canWrite ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Du hast in diesem Haushalt nur Leserechte. Rezepte können nicht
          gespeichert werden.
        </p>
      ) : null}

      <RecipeForm mode="create" canWrite={active.canWrite} />
    </div>
  );
}
