"use client";

import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { ItemCard, type ItemRow } from "@/components/item-card";
import { ItemPhoto } from "@/components/item-photo";
import type { KitchenProduct } from "@/lib/types";
import { daysUntil, formatQty } from "@/lib/utils";

// Auf dem Server gibt es kein Layout; dort useEffect, um die SSR-Warnung zu
// vermeiden. Im Browser läuft der Effekt vor dem Paint.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const OPEN_GROUPS_KEY = "mk:open-product-groups";

function readOpenGroups(): Set<string> {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(OPEN_GROUPS_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function rememberOpenGroup(productId: string, open: boolean) {
  try {
    const ids = readOpenGroups();
    if (open) ids.add(productId);
    else ids.delete(productId);
    window.sessionStorage.setItem(
      OPEN_GROUPS_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // sessionStorage kann blockiert sein – dann eben ohne Merken.
  }
}

export function ProductGroupCard({
  product,
  items,
  photoUrl,
  categoryName,
  unitName,
  canWrite,
  redirectTo,
  shoppingItemIds,
  selectable = false,
  selectedIds,
  onToggleItem,
  onToggleMany,
}: {
  product: KitchenProduct;
  items: ItemRow[];
  photoUrl?: string | null;
  categoryName: string | null;
  unitName: string | null;
  canWrite: boolean;
  redirectTo: string;
  shoppingItemIds?: ReadonlySet<string>;
  /** Im Batch-Modus: Checkboxen für Gruppe und Zeilen anzeigen. */
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleItem?: (id: string) => void;
  onToggleMany?: (ids: string[], selected: boolean) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Aufgeklappte Gruppen über Navigationen/Remounts hinweg erhalten (z. B.
  // nach dem Speichern eines Artikels oder der Gruppendetails).
  useIsomorphicLayoutEffect(() => {
    if (!detailsRef.current) return;
    if (readOpenGroups().has(product.id)) {
      detailsRef.current.open = true;
    }
  }, [product.id]);

  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Number(item.qty ?? 0), 0);
  const expiredCount = items.filter((item) => {
    const days = daysUntil(item.expiry);
    return days !== null && days < 0;
  }).length;
  const expiringCount = items.filter((item) => {
    const days = daysUntil(item.expiry);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const editHref = `/items/${items[0].id}/edit?from=${encodeURIComponent(redirectTo)}&group=1`;
  const selectedCount = selectedIds
    ? items.filter((item) => selectedIds.has(item.id)).length
    : 0;
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-stone-300">
      <details
        ref={detailsRef}
        className="group"
        onToggle={(event) =>
          rememberOpenGroup(product.id, event.currentTarget.open)
        }
      >
        {/* Die gesamte Kopffläche klappt auf/zu – ein einziges großes
            Touch-Target. Der Chevron ist nur Indikator. */}
        <summary className="flex min-h-[72px] cursor-pointer list-none items-start gap-2 p-2 [&::-webkit-details-marker]:hidden">
          {selectable ? (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(element) => {
                if (element) {
                  element.indeterminate = selectedCount > 0 && !allSelected;
                }
              }}
              onChange={(event) =>
                onToggleMany?.(
                  items.map((item) => item.id),
                  event.target.checked,
                )
              }
              onClick={(event) => event.stopPropagation()}
              aria-label={`${product.name}: alle Artikel auswählen`}
              title="Alle Artikel der Gruppe auswählen"
              className="mt-4 size-4 shrink-0 cursor-pointer rounded border-stone-300 text-[var(--accent-700)] focus:ring-2 focus:ring-[var(--accent-500)]"
            />
          ) : null}
          <ItemPhoto
            productId={product.id}
            photoUrl={photoUrl}
            name={product.name}
            canWrite={canWrite}
            className="size-14 rounded-xl"
            iconClassName="size-5"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Zeile 1: Name links, Zähl-Pillen oben rechts (wie die
                MHD-Pille der Einzelkarte). */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-stone-900">
                {product.name}
              </p>
              {expiredCount > 0 || expiringCount > 0 ? (
                <span className="flex shrink-0 items-center gap-1">
                  {expiredCount > 0 ? (
                    <span
                      title={`${expiredCount} ${expiredCount === 1 ? "Artikel ist" : "Artikel sind"} abgelaufen`}
                      className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-red-700"
                    >
                      {expiredCount} abgelaufen
                    </span>
                  ) : null}
                  {expiringCount > 0 ? (
                    <span
                      title={`${expiringCount} ${expiringCount === 1 ? "Artikel läuft" : "Artikel laufen"} bald ab`}
                      className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-800"
                    >
                      {expiringCount} läuft bald ab
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {/* Zeile 2: Kategorie/Artikelzahl links, Stift + Chevron rechts. */}
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs leading-4 text-stone-500">
                {categoryName ?? "Allgemein"} · {items.length} Artikel
              </p>
              <span className="flex shrink-0 items-center gap-1">
                {canWrite ? (
                  <Link
                    href={editHref}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Produktgruppe ${product.name} bearbeiten`}
                    title="Produktgruppe bearbeiten"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                  >
                    <Pencil className="size-4" />
                  </Link>
                ) : null}
                <ChevronDown className="size-5 shrink-0 text-stone-400 transition group-open:rotate-180" />
              </span>
            </div>

            {/* Zeile 3: Gesamtmenge an derselben Position wie der
                Mengen-Stepper der Einzelkarte. */}
            <div>
              <span
                title={`Gesamtmenge: ${formatQty(total)} ${unitName ?? ""}`}
                aria-label={`Gesamtmenge: ${formatQty(total)} ${unitName ?? ""}`}
                className="inline-flex max-w-full items-center rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800"
              >
                <span className="truncate">
                  {formatQty(total)} {unitName ?? ""}
                </span>
              </span>
            </div>
          </div>
        </summary>

        <div className="border-t border-stone-100">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              canWrite={canWrite}
              redirectTo={redirectTo}
              groupRow
              onShoppingList={shoppingItemIds?.has(item.id) ?? false}
              selectable={selectable}
              selected={selectedIds?.has(item.id) ?? false}
              onSelectToggle={onToggleItem}
            />
          ))}
        </div>
      </details>
    </div>
  );
}
