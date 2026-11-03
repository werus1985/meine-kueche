"use client";

import { Package, Search, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { inputClass, Label } from "@/components/ui";
import type { KitchenProduct } from "@/lib/types";
import { cn, normalizeBarcode } from "@/lib/utils";

/**
 * Suche einer bestehenden Produktgruppe beim Anlegen. Filtert nach Name
 * UND Barcode. Ersetzt die native <datalist>, die auf iOS Safari kaum
 * funktioniert und bisher die komplette Label-Zeile inklusive Barcode
 * erzwang.
 */
export function ProductGroupPicker({
  products,
  categories,
  selectedProductId,
  onSelect,
}: {
  products: KitchenProduct[];
  categories: { id: string; name: string }[];
  selectedProductId: string;
  onSelect: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === selectedProductId);

  const textQuery = query.trim().toLocaleLowerCase("de-DE");
  const digitQuery = normalizeBarcode(query);
  const matches = products
    .filter((product) => {
      if (!textQuery && digitQuery.length < 4) return false;
      if (
        textQuery &&
        product.name.toLocaleLowerCase("de-DE").includes(textQuery)
      ) {
        return true;
      }
      return (
        digitQuery.length >= 4 &&
        product.barcode !== null &&
        product.barcode.includes(digitQuery)
      );
    })
    .slice(0, 8);

  function select(productId: string) {
    onSelect(productId);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      setQuery("");
    }
    if (event.key === "Enter" && matches.length > 0) {
      event.preventDefault();
      select(matches[0].id);
    }
  }

  return (
    <div className="relative">
      <Label htmlFor="product-search" hint="optional">
        Bestehende Produktgruppe
      </Label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
          <Package className="size-4 shrink-0 text-emerald-700" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900">
            {selected.name}
            {selected.barcode ? (
              <span className="ml-1 text-xs font-normal text-stone-500">
                · {selected.barcode}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => onSelect("")}
            aria-label="Produktgruppe entfernen"
            title="Produktgruppe entfernen"
            className="rounded-lg p-1.5 text-stone-500 transition hover:bg-white hover:text-stone-800"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              id="product-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
              placeholder="Name oder Barcode …"
              className={cn(inputClass, "pl-9 pr-3")}
              autoComplete="off"
            />
          </div>
          {open && (textQuery || digitQuery.length >= 4) ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
              {matches.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-stone-500">
                  Keine passende Produktgruppe – der Artikel wird ohne Gruppe
                  gespeichert.
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {matches.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        // onMouseDown feuert vor onBlur und nimmt die Auswahl mit.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          select(product.id);
                        }}
                        className="flex w-full min-w-0 items-center gap-2 border-b border-stone-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-emerald-50"
                      >
                        <Package className="size-4 shrink-0 text-stone-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-900">
                            {product.name}
                          </span>
                          <span className="block truncate text-xs text-stone-500">
                            {product.barcode ?? "ohne Barcode"} ·{" "}
                            {categories.find(
                              (category) => category.id === product.category_id,
                            )?.name ?? "Allgemein"}
                            {product.itemCount
                              ? ` · ${product.itemCount} Artikel`
                              : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
