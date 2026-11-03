"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { createCategoryInlineAction } from "@/actions/settings";
import { buttonGhost, inputClass, selectClass } from "@/components/ui";

export function CategorySelect({
  categories,
  defaultValue = "",
  canWrite = true,
}: {
  categories: { id: string; name: string }[];
  defaultValue?: string;
  canWrite?: boolean;
}) {
  const [options, setOptions] = useState(categories);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createCategoryInlineAction(trimmed);
      if (!result.ok || !result.category) {
        setError(result.message);
        return;
      }

      const created = result.category;
      setOptions((previous) =>
        [...previous.filter((entry) => entry.id !== created.id), created].sort(
          (a, b) => a.name.localeCompare(b.name, "de"),
        ),
      );
      setValue(created.id);
      setName("");
      setError(null);
      setOpen(false);
    });
  }

  // „Allgemein“ existiert als echte Kategorie pro Haushalt. Die Auswahlzeile
  // nutzt deshalb dessen ID – sonst stünde „Allgemein“ doppelt in der Liste.
  const fallback = options.find(
    (category) => category.name.trim().toLocaleLowerCase("de-DE") === "allgemein",
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor="category_id"
          className="text-sm font-medium text-stone-700"
        >
          Kategorie
        </label>
        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setOpen((current) => !current);
              setError(null);
            }}
            className={buttonGhost}
          >
            {open ? (
              <>
                <X className="size-3.5" /> Abbrechen
              </>
            ) : (
              <>
                <Plus className="size-3.5" /> Neue Kategorie
              </>
            )}
          </button>
        ) : null}
      </div>

      <select
        id="category_id"
        name="category_id"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={selectClass}
      >
        <option value={fallback?.id ?? ""}>
          {fallback ? "Allgemein" : "Keine Kategorie"}
        </option>
        {options
          .filter((category) => category.id !== fallback?.id)
          .map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
      </select>

      {open ? (
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
            }}
            maxLength={80}
            autoFocus
            placeholder="z. B. Backzutaten"
            aria-label="Name der neuen Kategorie"
            className={inputClass}
          />
          <button
            type="button"
            onClick={create}
            disabled={pending || !name.trim()}
            className={`${buttonGhost} shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Anlegen
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
