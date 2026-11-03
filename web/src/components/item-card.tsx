"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  Pencil,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import {
  addToShoppingListAction,
  deleteItemAction,
  moveToStockAction,
} from "@/actions/items";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { ItemNoteEditor } from "@/components/item-note-editor";
import { ItemPhoto } from "@/components/item-photo";
import { QuantityControl } from "@/components/quantity-control";
import { ShoppingCheckbox } from "@/components/shopping-checkbox";
import { cn, expiryLabel, expiryTone, relativeDayLabel } from "@/lib/utils";

export type ItemRow = {
  id: string;
  product_id: string | null;
  name: string;
  kind: string;
  barcode: string | null;
  qty: number | null;
  expiry: string | null;
  purchased_at: string | null;
  checked: boolean;
  notes: string;
  photo_path: string | null;
  category_id: string | null;
  location_id: string | null;
  unit_id: string | null;
  updated_at: string;
  kitchen_categories: { id: string; name: string } | { id: string; name: string }[] | null;
  kitchen_locations: { id: string; name: string } | { id: string; name: string }[] | null;
  kitchen_units:
    | { id: string; name: string; step_size: number }
    | { id: string; name: string; step_size: number }[]
    | null;
};

function relationName(
  value: { name: string } | { name: string }[] | null | undefined,
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name ?? null : value.name;
}

function relationStepSize(
  value:
    | { step_size: number }
    | { step_size: number }[]
    | null
    | undefined,
) {
  if (!value) return 1;
  const step = Array.isArray(value) ? value[0]?.step_size : value.step_size;
  const number = Number(step);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function ageLabel(purchasedAt: string | null) {
  const label = relativeDayLabel(purchasedAt);
  return label ? `${label} gekauft` : null;
}

export function ItemCard({
  item,
  photoUrl,
  canWrite,
  redirectTo,
  groupRow = false,
  onShoppingList = false,
  selectable = false,
  selected = false,
  onSelectToggle,
}: {
  item: ItemRow;
  photoUrl?: string | null;
  canWrite: boolean;
  redirectTo: string;
  groupRow?: boolean;
  onShoppingList?: boolean;
  /** Im Batch-Modus: Checkbox vor der Karte anzeigen. */
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
}) {
  const category = relationName(item.kitchen_categories);
  const location = relationName(item.kitchen_locations);
  const unit = relationName(item.kitchen_units);
  const unitStep = relationStepSize(item.kitchen_units);
  const isShopping = item.kind === "shop";
  const outOfStock = !isShopping && (item.qty ?? 0) <= 0;
  const tone = expiryTone(item.expiry);
  const dateLabel = item.expiry
    ? expiryLabel(item.expiry)
    : isShopping
      ? relativeDayLabel(item.purchased_at)
      : ageLabel(item.purchased_at);
  const editHref = `/items/${item.id}/edit?from=${encodeURIComponent(redirectTo)}`;
  // Warenkorb: rot = Menge 0 und nicht auf der Liste, gelb = Menge 0 aber
  // bereits auf der Einkaufsliste.
  const cartTone = !outOfStock
    ? "text-stone-500 hover:bg-[var(--accent-50)] hover:text-[var(--accent-800)]"
    : onShoppingList
      ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
      : "text-red-700 hover:bg-red-50 hover:text-red-800";
  const cartLabel = !outOfStock
    ? "Auf Einkaufsliste setzen"
    : onShoppingList
      ? "Bereits auf der Einkaufsliste"
      : "Nachkaufen";

  const selectionBox = selectable ? (
    <input
      type="checkbox"
      checked={selected}
      onChange={() => onSelectToggle?.(item.id)}
      aria-label={`${item.name} auswählen`}
      className="size-4 shrink-0 cursor-pointer rounded border-stone-300 text-[var(--accent-700)] focus:ring-2 focus:ring-[var(--accent-500)]"
    />
  ) : null;

  // Bearbeiten ausschließlich über den Stift – der Kartenkörper ist kein Link.
  const actionButtons = canWrite ? (
    <>
      {isShopping ? (
        <form action={moveToStockAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label="In den Vorrat übernehmen"
            title="In den Vorrat übernehmen"
            className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-[var(--accent-50)] hover:text-[var(--accent-800)]"
          >
            <ArrowDownToLine className="size-4" />
          </button>
        </form>
      ) : (
        <form action={addToShoppingListAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label={cartLabel}
            title={cartLabel}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg transition",
              cartTone,
            )}
          >
            <ShoppingCart className="size-4" />
          </button>
        </form>
      )}
      <Link
        href={editHref}
        aria-label="Bearbeiten"
        title="Bearbeiten"
        className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
      >
        <Pencil className="size-4" />
      </Link>
      <form action={deleteItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <ConfirmSubmitButton
          message={`„${item.name}“ wirklich löschen?`}
          ariaLabel="Löschen"
          title="Löschen"
          className="inline-flex size-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="size-4" />
        </ConfirmSubmitButton>
      </form>
    </>
  ) : (
    <Link
      href={editHref}
      aria-label="Ansehen"
      title="Ansehen"
      className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
    >
      <Pencil className="size-4" />
    </Link>
  );

  if (groupRow) {
    return (
      <article className="min-w-0 border-t border-stone-100 px-3 py-2 first:border-t-0">
        <ItemNoteEditor itemId={item.id} notes={item.notes} canWrite={canWrite}>
          {(toggle) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                {selectionBox}
                <span
                  title={dateLabel ?? "Kein MHD oder Kaufdatum"}
                  className={cn(
                    "max-w-[55%] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    tone === "expired"
                      ? "bg-red-50 text-red-700"
                      : tone === "soon"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-stone-100 text-stone-600",
                  )}
                >
                  {dateLabel ?? "Kein Datum"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
                  {location ?? "Kein Lagerort"}
                </span>
              </div>

              <div>
                <QuantityControl
                  itemId={item.id}
                  qty={item.qty}
                  unitName={unit}
                  stepSize={unitStep}
                  canWrite={canWrite}
                  compact
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="shrink-0">{toggle}</div>
                <div className="ml-auto flex items-center gap-1">
                  {actionButtons}
                </div>
              </div>
            </div>
          )}
        </ItemNoteEditor>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-2 shadow-sm transition hover:border-stone-300",
        isShopping && item.checked && "opacity-60",
      )}
    >
      <ItemNoteEditor itemId={item.id} notes={item.notes} canWrite={canWrite}>
        {(toggle) => (
          <div className="flex gap-2">
            {selectionBox ? <span className="mt-1 flex shrink-0">{selectionBox}</span> : null}
            <ItemPhoto
              itemId={item.product_id ? undefined : item.id}
              productId={item.product_id ?? undefined}
              photoUrl={photoUrl}
              name={item.name}
              canWrite={canWrite}
              className="size-14 rounded-xl"
            />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-1.5">
                {isShopping ? (
                  <ShoppingCheckbox
                    itemId={item.id}
                    checked={item.checked}
                    canWrite={canWrite}
                    label={`${item.name} als gekauft abhaken`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm font-semibold leading-5 text-stone-900",
                        isShopping && item.checked && "line-through",
                      )}
                    >
                      {item.name}
                    </p>
                    {dateLabel ? (
                      <span
                        title={dateLabel}
                        className={cn(
                          "max-w-[45%] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4",
                          tone === "expired"
                            ? "bg-red-50 text-red-700"
                            : tone === "soon"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-stone-100 text-stone-600",
                        )}
                      >
                        {dateLabel}
                      </span>
                    ) : isShopping ? (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold leading-4 text-stone-600">
                        {item.checked ? "Gekauft" : "Offen"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-stone-500">
                    <span className="min-w-0 flex-1 truncate">
                      {category ?? "Allgemein"} · {location ?? "Sonstiges"}
                    </span>
                  </div>

                  <div className="mt-1">
                    <QuantityControl
                      itemId={item.id}
                      qty={item.qty}
                      unitName={unit}
                      stepSize={unitStep}
                      canWrite={canWrite}
                      compact
                    />
                  </div>

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="shrink-0">{toggle}</div>
                    <div className="ml-auto flex items-center gap-1">
                      {actionButtons}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ItemNoteEditor>
    </article>
  );
}
