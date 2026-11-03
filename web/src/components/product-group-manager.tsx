"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Package,
  Pencil,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteProductGroupAction,
  toggleProductGroupSeasonalAction,
  updateProductGroupAction,
} from "@/actions/settings";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  buttonPrimary,
  buttonSecondary,
  Card,
  CardHeader,
  inputClass,
  Label,
  selectClass,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export type ProductGroupRow = {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  photoUrl: string | null;
  seasonal: boolean;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("de-DE").trim();
}

function ProductGroupItem({
  group,
  categories,
  units,
  canWrite,
}: {
  group: ProductGroupRow;
  categories: { id: string; name: string }[];
  units: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(updateProductGroupAction, null);

  return (
    <li
      className={cn(
        "px-4 py-3",
        group.seasonal ? "bg-amber-50/70" : "bg-white",
      )}
    >
      {editing ? (
        <form action={formAction} className="space-y-3">
          <FormMessage state={state} />
          <input type="hidden" name="id" value={group.id} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <Label htmlFor={`group-name-${group.id}`}>Name</Label>
              <input
                id={`group-name-${group.id}`}
                name="name"
                required
                maxLength={200}
                defaultValue={group.name}
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor={`group-barcode-${group.id}`} hint="8–14 Ziffern">
                Barcode
              </Label>
              <input
                id={`group-barcode-${group.id}`}
                name="barcode"
                inputMode="numeric"
                pattern="[0-9]{8,14}"
                defaultValue={group.barcode ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor={`group-category-${group.id}`}>Kategorie</Label>
              <select
                id={`group-category-${group.id}`}
                name="category_id"
                defaultValue={group.categoryId ?? ""}
                className={selectClass}
              >
                <option value="">Keine Kategorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`group-unit-${group.id}`}>Einheit</Label>
              <select
                id={`group-unit-${group.id}`}
                name="unit_id"
                defaultValue={group.unitId ?? ""}
                className={selectClass}
              >
                <option value="">Keine Einheit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton className={buttonPrimary}>
              <Save className="size-4" /> Speichern
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonSecondary}
            >
              <X className="size-4" /> Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-400">
            {group.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <Package className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-medium text-stone-900">
                {group.name}
              </p>
              {group.seasonal ? <Badge tone="amber">Saisonal</Badge> : null}
            </div>
            <p className="truncate text-xs text-stone-500">
              {group.barcode ? `Barcode ${group.barcode} · ` : ""}
              {group.categoryName ?? "Keine Kategorie"} ·{" "}
              {group.unitName ?? "Keine Einheit"}
            </p>
          </div>
          {canWrite ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Produktgruppe bearbeiten"
                title="Bearbeiten"
                className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                <Pencil className="size-4" />
              </button>
              <form action={toggleProductGroupSeasonalAction}>
                <input type="hidden" name="id" value={group.id} />
                <button
                  type="submit"
                  aria-pressed={group.seasonal}
                  aria-label={
                    group.seasonal
                      ? "Saisonal-Schutz aufheben"
                      : "Vor automatischer Löschung schützen"
                  }
                  title={
                    group.seasonal
                      ? "Geschützt – wird nicht automatisch entfernt"
                      : "Vor automatischer Entfernung schützen"
                  }
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-lg border transition",
                    group.seasonal
                      ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-amber-50 hover:text-amber-800",
                  )}
                >
                  {group.seasonal ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <Shield className="size-4" />
                  )}
                </button>
              </form>
              <form action={deleteProductGroupAction}>
                <input type="hidden" name="id" value={group.id} />
                <ConfirmSubmitButton
                  message={`„${group.name}“ endgültig löschen? Die Gruppe hat keine Artikel mehr.`}
                  ariaLabel="Produktgruppe löschen"
                  title="Löschen"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" />
                </ConfirmSubmitButton>
              </form>
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function ProductGroupManager({
  groups,
  categories,
  units,
  canWrite,
}: {
  groups: ProductGroupRow[];
  categories: { id: string; name: string }[];
  units: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return groups;
    return groups.filter((group) =>
      [group.name, group.barcode ?? "", group.categoryName ?? ""].some(
        (value) => normalize(value).includes(needle),
      ),
    );
  }, [groups, query]);

  return (
    <Card>
      <CardHeader
        title="Ungenutzte Produktgruppen"
        description="Gruppen ohne Artikel. Nicht saisonale Gruppen werden nach 6 Monaten ohne Nutzung automatisch entfernt."
      />
      <div className="px-5 py-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nach Name, Kategorie oder Barcode suchen …"
            aria-label="Produktgruppen durchsuchen"
            className={cn(inputClass, "pl-9")}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-500">
            {groups.length === 0
              ? "Keine ungenutzten Produktgruppen vorhanden."
              : "Keine Treffer."}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
            {filtered.map((group) => (
              <ProductGroupItem
                key={group.id}
                group={group}
                categories={categories}
                units={units}
                canWrite={canWrite}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
