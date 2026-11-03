"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { saveQuickFilterAction } from "@/actions/settings";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export function SaveQuickFilter({
  categoryIds,
  defaultName,
}: {
  categoryIds: string[];
  defaultName: string;
}) {
  const [state, formAction] = useActionState(saveQuickFilterAction, null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="mt-2 border-t border-stone-100 pt-2">
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-800)] hover:underline"
        >
          <Plus className="size-3.5" /> Auswahl als Schnellfilter speichern
        </button>
      ) : (
        <form action={formAction}>
          <FormMessage state={state} />
          {categoryIds.map((categoryId) => (
            <input
              key={categoryId}
              type="hidden"
              name="categoryIds"
              value={categoryId}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="quick-filter-name"
              name="name"
              required
              maxLength={80}
              defaultValue={defaultName}
              placeholder="Name für Schnellfilter"
              aria-label="Name für Schnellfilter"
              className={cn(inputClass, "min-w-40 flex-1")}
            />
            <SubmitButton className={buttonSecondary}>
              <Plus className="size-4" /> Speichern
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-2 text-xs text-stone-500 hover:text-stone-800"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
