"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { ItemForm, type ItemFormValue } from "@/components/item-form";
import type { KitchenProduct } from "@/lib/types";

type FormOptions = {
  kind: "stock" | "shop";
  barcode?: string;
  item?: ItemFormValue;
  photoUrl?: string | null;
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  units: { id: string; name: string; step_size: number }[];
  products: KitchenProduct[];
  initialPurchasedAt: string;
  canWrite: boolean;
  redirectTo?: string;
};

export function NewItemDialog({
  kind,
  barcode = "",
  categories,
  locations,
  units,
  products,
  initialPurchasedAt,
  canWrite,
  redirectTo,
}: FormOptions) {
  return (
    <ItemDialog
      mode="create"
      kind={kind}
      barcode={barcode}
      categories={categories}
      locations={locations}
      units={units}
      products={products}
      initialPurchasedAt={initialPurchasedAt}
      canWrite={canWrite}
      redirectTo={redirectTo}
    />
  );
}

export function EditItemDialog({
  item,
  photoUrl,
  categories,
  locations,
  units,
  products,
  initialPurchasedAt,
  canWrite,
  redirectTo,
  groupOnly = false,
}: Omit<FormOptions, "barcode" | "kind"> & {
  item: ItemFormValue;
  groupOnly?: boolean;
}) {
  return (
    <ItemDialog
      mode="edit"
      kind={item.kind === "shop" ? "shop" : "stock"}
      item={item}
      photoUrl={photoUrl}
      categories={categories}
      locations={locations}
      units={units}
      products={products}
      initialPurchasedAt={initialPurchasedAt}
      canWrite={canWrite}
      redirectTo={redirectTo}
      groupOnly={groupOnly}
    />
  );
}

function ItemDialog({
  mode,
  kind,
  barcode = "",
  item,
  photoUrl,
  categories,
  locations,
  units,
  products,
  initialPurchasedAt,
  canWrite,
  redirectTo,
  groupOnly = false,
}: FormOptions & { mode: "create" | "edit"; groupOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const isOpen =
    pathname === "/items/new" || /^\/items\/[^/]+\/edit$/.test(pathname);
  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, isOpen]);

  if (!isOpen) return null;

  const title =
    mode === "edit"
      ? groupOnly
        ? "Produktgruppe bearbeiten"
        : item?.name ?? "Artikel bearbeiten"
      : kind === "shop"
        ? "Einkauf planen"
        : "Vorrat erfassen";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-5 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-item-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {groupOnly ? "Produktgruppe" : kind === "shop" ? "Einkauf" : "Vorrat"}
            </p>
            <h2
              id="new-item-dialog-title"
              className="truncate text-base font-semibold text-stone-900"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">
          {!canWrite ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              Du hast in diesem Haushalt nur Leserechte.
            </p>
          ) : null}

          <ItemForm
            mode={mode}
            item={item}
            categories={categories}
            locations={locations}
            units={units}
            products={products}
            initialPurchasedAt={item?.purchased_at ?? initialPurchasedAt}
            initialKind={kind}
            initialBarcode={barcode}
            photoUrl={photoUrl}
            canWrite={canWrite}
            onCancel={close}
            redirectTo={redirectTo}
            groupOnly={groupOnly}
          />
        </div>
      </div>
    </div>
  );
}
