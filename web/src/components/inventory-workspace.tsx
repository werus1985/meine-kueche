"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  clearShoppingListAction,
  deleteCheckedShoppingAction,
  deleteItemsAction,
  moveCheckedToStockAction,
} from "@/actions/items";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { ItemCard, type ItemRow } from "@/components/item-card";
import { ProductGroupCard } from "@/components/product-group-card";
import { StockFilterPanel } from "@/components/stock-filter-panel";
import {
  Alert,
  buttonPrimary,
  Card,
  CardHeader,
  EmptyState,
} from "@/components/ui";
import { cn, daysUntil } from "@/lib/utils";
import type { KitchenProduct } from "@/lib/types";

type CategoryOption = { id: string; name: string };
type LocationOption = { id: string; name: string };
type QuickFilterOption = {
  id: string;
  name: string;
  categoryIds: string[];
};
type InventoryItem = ItemRow & { photoUrl: string | null };
type InventoryProduct = KitchenProduct & { photoUrl: string | null };
type Kind = "stock" | "shop";

// Auf dem Server gibt es kein Layout; dort useEffect verwenden, damit keine
// SSR-Warnung entsteht. Im Browser läuft der Effekt vor dem Paint.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function setUrlParams(params: URLSearchParams, hash = window.location.hash) {
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${hash}`,
  );
}

function StatusChip({
  children,
  active,
  tone,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  tone: "amber" | "red";
  onClick: () => void;
}) {
  const colors = {
    amber: active
      ? "border-amber-600 bg-amber-600 text-white"
      : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400",
    red: active
      ? "border-red-700 bg-red-700 text-white"
      : "border-red-200 bg-red-50 text-red-900 hover:border-red-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
        colors[tone],
      )}
    >
      {children}
    </button>
  );
}

export function InventoryWorkspace({
  initialKind,
  stockItems,
  shopItems,
  products,
  categories,
  locations,
  units,
  quickFilters,
  canWrite,
  status,
  barcodeMissing,
}: {
  initialKind: Kind;
  stockItems: InventoryItem[];
  shopItems: InventoryItem[];
  products: InventoryProduct[];
  categories: CategoryOption[];
  locations: LocationOption[];
  units: { id: string; name: string }[];
  quickFilters: QuickFilterOption[];
  canWrite: boolean;
  status?: { message: string; tone: "success" | "error" } | null;
  barcodeMissing: string | null;
}) {
  const searchParams = useSearchParams();
  // Der Tab wird primär aus der URL gelesen. `initialKind` dient nur als
  // Rückfall, wenn (noch) kein `kind`-Parameter vorhanden ist – sonst würde
  // ein Server-Action-Refresh (z. B. nach dem Abhaken eines Einkaufsartikels)
  // den per Swipe gesetzten Tab zurücksetzen.
  const kindParam = searchParams.get("kind");
  const kind: Kind =
    kindParam === "shop" ? "shop" : kindParam === "stock" ? "stock" : initialKind;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const scrollPositions = useRef<Record<Kind, number>>({ stock: 0, shop: 0 });
  // Zielposition nach einem Tab-Wechsel; wird erst gesetzt, wenn die neue
  // Liste tatsächlich gerendert ist (siehe Effekt unten).
  const pendingScroll = useRef<number | null>(null);

  // Batch-Auswahl im Vorrat.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deletePending, startDelete] = useTransition();

  // Akzentfarbe (grün/blau) gilt für die ganze Oberfläche, damit auch
  // Kopfzeile, Sidebar und KI-Button im Einkaufs-Tab blau werden.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("accent-shop", kind === "shop");
    return () => {
      root.classList.remove("accent-shop");
    };
  }, [kind]);

  // Scroll-Position erst nach dem Rendern der neuen Liste wiederherstellen –
  // ein requestAnimationFrame lief bisher vor dem React-Commit und wurde vom
  // Router-Refresh teils überschrieben.
  useIsomorphicLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    const top = pendingScroll.current;
    pendingScroll.current = null;
    window.scrollTo(0, top);
  }, [kind]);

  // Tab-Wechsel (auch per Zurück-Button) beendet den Auswahlmodus. State
  // während des Renderns anzupassen ist hier das von React empfohlene Muster.
  const [lastKind, setLastKind] = useState<Kind>(kind);
  if (kind !== lastKind) {
    setLastKind(kind);
    setSelecting(false);
    setSelected(new Set());
  }

  const categoryParam = searchParams.get("category");
  const categoryIds = useMemo(
    () =>
      (categoryParam ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [categoryParam],
  );
  const quickFilterId = searchParams.get("quickFilter") ?? "";
  const quickFilter = quickFilters.find((filter) => filter.id === quickFilterId);
  const effectiveCategoryIds = useMemo(
    () => (categoryIds.length > 0 ? categoryIds : (quickFilter?.categoryIds ?? [])),
    [categoryIds, quickFilter],
  );
  const query = (searchParams.get("q") ?? searchParams.get("barcode") ?? "")
    .trim()
    .toLocaleLowerCase("de-DE");
  const locationParam = searchParams.get("location");
  const locationIds = useMemo(
    () =>
      (locationParam ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [locationParam],
  );
  const sort = searchParams.get("sort") ?? "expiry";
  const expiredOnly = searchParams.get("expired") === "1";
  const expiringOnly = searchParams.get("expiring") === "1";
  const filteredStock = useMemo(() => {
    const matches = stockItems.filter((item) => {
      if (query) {
        const haystack = [item.name, item.notes, item.barcode]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("de-DE");
        if (!haystack.includes(query)) return false;
      }
      if (
        effectiveCategoryIds.length > 0 &&
        (!item.category_id || !effectiveCategoryIds.includes(item.category_id))
      ) {
        return false;
      }
      if (
        locationIds.length > 0 &&
        (!item.location_id || !locationIds.includes(item.location_id))
      ) {
        return false;
      }
      const expiryDays = daysUntil(item.expiry);
      if (expiredOnly && (expiryDays === null || expiryDays >= 0)) return false;
      if (expiringOnly && (expiryDays === null || expiryDays < 0 || expiryDays > 7)) return false;
      return true;
    });

    return matches.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      if (sort === "updated")
        return b.updated_at.localeCompare(a.updated_at);
      return (
        (a.expiry ?? "9999-12-31").localeCompare(b.expiry ?? "9999-12-31") ||
        a.name.localeCompare(b.name, "de")
      );
    });
  }, [
    stockItems,
    query,
    effectiveCategoryIds,
    locationIds,
    expiredOnly,
    expiringOnly,
    sort,
  ]);

  const filteredShopping = useMemo(() => {
    const matching = shopItems.filter((item) => {
      if (query) {
        const haystack = [item.name, item.notes, item.barcode]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("de-DE");
        if (!haystack.includes(query)) return false;
      }
      if (
        effectiveCategoryIds.length > 0 &&
        (!item.category_id || !effectiveCategoryIds.includes(item.category_id))
      ) {
        return false;
      }
      if (
        locationIds.length > 0 &&
        (!item.location_id || !locationIds.includes(item.location_id))
      ) {
        return false;
      }
      return true;
    });
    return matching.sort(
      (a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, "de"),
    );
  }, [shopItems, query, effectiveCategoryIds, locationIds]);

  const stockEntries = useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    const grouped = new Map<string, InventoryItem[]>();
    const entries: (
      | { type: "item"; item: InventoryItem; photoUrl?: string | null }
      | { type: "product"; product: InventoryProduct; items: InventoryItem[] }
    )[] = [];

    for (const item of filteredStock) {
      if (item.product_id && productById.has(item.product_id)) {
        const current = grouped.get(item.product_id);
        if (current) current.push(item);
        else {
          const members = [item];
          grouped.set(item.product_id, members);
          entries.push({
            type: "product",
            product: productById.get(item.product_id)!,
            items: members,
          });
        }
      } else {
        entries.push({ type: "item", item });
      }
    }

    // Eine Gruppe mit nur einem sichtbaren Artikel verhält sich wie ein
    // Einzelprodukt (kein Aufklappen, kein Gruppenkopf).
    return entries.map((entry) =>
      entry.type === "product" && entry.items.length === 1
        ? {
            type: "item" as const,
            item: entry.items[0],
            photoUrl: entry.product.photoUrl,
          }
        : entry,
    );
  }, [filteredStock, products]);

  // Welche Vorratsartikel stehen bereits auf der Einkaufsliste? (für die
  // Warenkorb-Farbe: rot = fehlt, gelb = schon gelistet)
  const shoppingProductIds = useMemo(
    () =>
      new Set(
        shopItems
          .map((item) => item.product_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [shopItems],
  );
  const shoppingNames = useMemo(
    () => new Set(shopItems.map((item) => item.name.toLocaleLowerCase("de-DE"))),
    [shopItems],
  );
  const stockOnShoppingList = useMemo(
    () =>
      new Set(
        stockItems
          .filter((item) =>
            item.product_id
              ? shoppingProductIds.has(item.product_id)
              : shoppingNames.has(item.name.toLocaleLowerCase("de-DE")),
          )
          .map((item) => item.id),
      ),
    [stockItems, shoppingProductIds, shoppingNames],
  );

  const openShopping = filteredShopping.filter((item) => !item.checked);
  const doneShopping = filteredShopping.filter((item) => item.checked);
  const barcodeQuery = (searchParams.get("barcode") ?? searchParams.get("q") ?? "").trim();
  const barcodeToPrefill = /^\d{8,14}$/.test(barcodeQuery) ? barcodeQuery : null;
  const knownBarcodeProduct = barcodeToPrefill
    ? products.find((product) => product.barcode === barcodeToPrefill) ?? null
    : null;
  // Barcode-Wissen liegt auf den Produkten; Artikel spiegeln es nur.
  const missingBarcode =
    barcodeMissing ??
    (barcodeToPrefill && !knownBarcodeProduct ? barcodeToPrefill : null);
  const expiringCount = stockItems.filter((item) => {
    const days = daysUntil(item.expiry);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const expiredCount = stockItems.filter((item) => {
    const days = daysUntil(item.expiry);
    return days !== null && days < 0;
  }).length;
  const returnParams = new URLSearchParams(searchParams.toString());
  returnParams.set("kind", kind);
  for (const key of ["created", "updated", "product", "moved", "deleted", "cleared", "error", "from"]) {
    returnParams.delete(key);
  }
  const returnHash = kind === "shop" ? "#einkauf" : "#vorrat";
  const returnTo = `/items?${returnParams.toString()}${returnHash}`;
  const newItemHref = `/items/new?kind=${kind}&from=${encodeURIComponent(returnTo)}${
    barcodeToPrefill ? `&barcode=${encodeURIComponent(barcodeToPrefill)}` : ""
  }`;

  function toggleSelectMode() {
    setSelected(new Set());
    setSelecting((current) => !current);
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMany(ids: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filteredStock.map((item) => item.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0 || deletePending) return;
    const label = ids.length === 1 ? "1 Artikel" : `${ids.length} Artikel`;
    if (!window.confirm(`${label} wirklich löschen?`)) return;
    setSelected(new Set());
    startDelete(async () => {
      await deleteItemsAction(ids);
    });
  }

  function switchTo(next: Kind) {
    if (next === kind) return;
    setSelecting(false);
    setSelected(new Set());
    scrollPositions.current[kind] = window.scrollY;
    pendingScroll.current = scrollPositions.current[next];
    const params = new URLSearchParams(searchParams.toString());
    params.set("kind", next);
    params.delete("expired");
    params.delete("expiring");
    for (const key of ["created", "updated", "product", "moved", "deleted", "cleared", "error"]) {
      params.delete(key);
    }
    setUrlParams(params, next === "shop" ? "#einkauf" : "#vorrat");
  }

  function toggleStatus(statusKey: "expired" | "expiring") {
    const params = new URLSearchParams(searchParams.toString());
    const next = params.get(statusKey) === "1" ? null : "1";
    params.delete("expired");
    params.delete("expiring");
    if (next) params.set(statusKey, next);
    params.set("kind", "stock");
    setUrlParams(params, "#vorrat");
  }

  return (
    <div
      className={kind === "shop" ? "accent-shop" : undefined}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          switchTo(dx < 0 ? "shop" : "stock");
        }
      }}
    >
      <div className="mb-3 grid w-full grid-cols-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Vorrat oder Einkaufsliste">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "stock"}
          onClick={() => switchTo("stock")}
          className={cn(
            "flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4",
            kind === "stock"
              ? "bg-[var(--accent-700)] text-white shadow-sm"
              : "text-stone-600 hover:bg-stone-100",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Package className="size-4 shrink-0" />
            <span className="truncate">Vorräte</span>
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs", kind === "stock" ? "bg-[var(--accent-800)] text-white" : "bg-stone-100 text-stone-600")}>
            {stockItems.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "shop"}
          onClick={() => switchTo("shop")}
          className={cn(
            "flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4",
            kind === "shop"
              ? "bg-[var(--accent-700)] text-white shadow-sm"
              : "text-stone-600 hover:bg-stone-100",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <ShoppingCart className="size-4 shrink-0" />
            <span className="truncate">Einkauf</span>
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs", kind === "shop" ? "bg-[var(--accent-800)] text-white" : "bg-stone-100 text-stone-600")}>
            {shopItems.filter((item) => !item.checked).length}
          </span>
        </button>
      </div>

      {status ? (
        <div className="mb-3">
          <Alert tone={status.tone}>{status.message}</Alert>
        </div>
      ) : null}

      {missingBarcode ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Barcode <span className="font-mono">{missingBarcode}</span> nicht
          gefunden. Über + kannst du ihn direkt als neuen Artikel anlegen.
        </div>
      ) : null}
      {!missingBarcode && knownBarcodeProduct ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          Produktgruppe <strong>{knownBarcodeProduct.name}</strong> erkannt. Über + legst du einen weiteren Artikel dieser Gruppe an.
        </div>
      ) : null}

      <div className="sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] z-30 -mx-4 mb-3 px-4 py-1 sm:-mx-6 sm:px-6 lg:top-2 lg:-mx-8 lg:px-8">
        <StockFilterPanel
          categories={categories}
          locations={locations}
          quickFilters={quickFilters}
          initialCategoryIds={[]}
          initialQuickFilterId=""
          canWrite={canWrite}
        />
      </div>

      {kind === "stock" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <StatusChip
              active={expiringOnly}
              tone="amber"
              onClick={() => toggleStatus("expiring")}
            >
              Läuft bald ab · {expiringCount}
            </StatusChip>
            <StatusChip
              active={expiredOnly}
              tone="red"
              onClick={() => toggleStatus("expired")}
            >
              Abgelaufen · {expiredCount}
            </StatusChip>
          </div>
          <span className="whitespace-nowrap text-xs text-stone-500">
            {filteredStock.length} von {stockItems.length} Vorräten
          </span>
        </div>
      ) : null}

      {kind === "stock" && selecting ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-200)] bg-[var(--accent-50)] px-3 py-2 text-xs text-[var(--accent-900)]">
          <span className="font-semibold">{selected.size} ausgewählt</span>
          <button
            type="button"
            onClick={selectAllVisible}
            className="font-medium underline-offset-2 hover:underline"
          >
            Alle ({filteredStock.length})
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="font-medium underline-offset-2 hover:underline"
          >
            Keine
          </button>
        </div>
      ) : null}

      <section
        id={kind === "stock" ? "vorrat" : "einkauf"}
        className="scroll-mt-36 pb-32"
        style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
      >
        {/* Beide Listen bleiben gemountet, damit aufgeklappte Gruppen,
            Notiz-Entwürfe und Scrollposition den Tab-Wechsel überleben. */}
        <div className={cn(kind !== "stock" && "hidden")}>
          {filteredStock.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Package className="size-5" />}
                title={
                  expiredOnly
                    ? "Nichts abgelaufen"
                    : expiringOnly
                      ? "Nichts läuft bald ab"
                      : stockItems.length === 0
                        ? "Noch keine Vorräte"
                        : "Keine Treffer"
                }
                description={
                  stockItems.length === 0
                    ? "Lege den ersten Artikel mit dem + an."
                    : "Passe Suche oder Filter an."
                }
              />
            </Card>
          ) : (
            <div className="grid items-start gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {stockEntries.map((entry) =>
                entry.type === "item" ? (
                  <ItemCard
                    key={`item-${entry.item.id}`}
                    item={entry.item}
                    photoUrl={entry.photoUrl ?? entry.item.photoUrl}
                    canWrite={canWrite}
                    redirectTo={returnTo}
                    onShoppingList={stockOnShoppingList.has(entry.item.id)}
                    selectable={selecting}
                    selected={selected.has(entry.item.id)}
                    onSelectToggle={toggleSelected}
                  />
                ) : (
                  <ProductGroupCard
                    key={`product-${entry.product.id}`}
                    product={entry.product}
                    items={entry.items}
                    photoUrl={entry.product.photoUrl}
                    categoryName={categories.find((category) => category.id === entry.product.category_id)?.name ?? null}
                    unitName={units.find((unit) => unit.id === entry.product.unit_id)?.name ?? null}
                    canWrite={canWrite}
                    redirectTo={returnTo}
                    shoppingItemIds={stockOnShoppingList}
                    selectable={selecting}
                    selectedIds={selected}
                    onToggleItem={toggleSelected}
                    onToggleMany={toggleMany}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className={cn(kind !== "shop" && "hidden")}>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-stone-900">Offen</h2>
                <span className="text-xs text-stone-500">
                  {openShopping.length} {openShopping.length === 1 ? "Eintrag" : "Einträge"}
                </span>
              </div>
              {canWrite && shopItems.length > 0 ? (
                <form action={clearShoppingListAction}>
                  <ConfirmSubmitButton
                    message={`Einkaufsliste wirklich leeren? ${shopItems.length} ${shopItems.length === 1 ? "Eintrag wird" : "Einträge werden"} gelöscht (offene und erledigte).`}
                    ariaLabel="Einkaufsliste leeren"
                    title="Einkaufsliste leeren"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" /> Liste leeren
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
            {openShopping.length === 0 ? (
              <Card className="mb-3">
                <EmptyState
                  icon={<ShoppingCart className="size-5" />}
                  title="Nichts zu kaufen"
                  description="Über + kannst du einen Eintrag hinzufügen oder Vorräte direkt auf die Einkaufsliste setzen."
                />
              </Card>
            ) : (
              <div className="mb-4 grid items-start gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {openShopping.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    photoUrl={item.photoUrl}
                    canWrite={canWrite}
                    redirectTo={returnTo}
                  />
                ))}
              </div>
            )}

            {doneShopping.length > 0 ? (
              <Card>
                <CardHeader
                  title="Erledigt"
                  description={`${doneShopping.length} abgehakt`}
                  action={
                    canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={moveCheckedToStockAction}>
                          <button type="submit" className={buttonPrimary}>
                            <Package className="size-4" /> In Vorrat übernehmen
                          </button>
                        </form>
                        <form action={deleteCheckedShoppingAction}>
                          <ConfirmSubmitButton
                            message={`${doneShopping.length} ${doneShopping.length === 1 ? "erledigten Eintrag" : "erledigte Einträge"} wirklich löschen?`}
                            ariaLabel="Erledigte Einträge löschen"
                            title="Erledigte Einträge löschen"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                          >
                            <Trash2 className="size-4" /> Löschen
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : null
                  }
                />
                <div className="grid items-start gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {doneShopping.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      photoUrl={item.photoUrl}
                      canWrite={canWrite}
                      redirectTo={returnTo}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
                  <CheckCircle2 className="size-4 text-[var(--accent-600)]" />
                  Abgehakte Einträge bleiben hier, bis du sie übernimmst oder löschst.
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </section>

      {kind === "stock" && canWrite && stockItems.length > 0 ? (
        <div className="fixed bottom-[calc(1.25rem_+_env(safe-area-inset-bottom))] left-[calc(1rem_+_env(safe-area-inset-left))] z-40 flex items-center gap-2 sm:bottom-6 sm:left-6">
          <button
            type="button"
            onClick={toggleSelectMode}
            aria-pressed={selecting}
            aria-label={selecting ? "Auswahl beenden" : "Artikel auswählen"}
            title={selecting ? "Auswahl beenden" : "Artikel auswählen"}
            className={cn(
              "inline-flex size-14 items-center justify-center rounded-full shadow-lg shadow-stone-950/20 transition focus:outline-none focus:ring-2 focus:ring-offset-2",
              selecting
                ? "bg-stone-800 text-white hover:bg-stone-900 focus:ring-stone-500"
                : "bg-[var(--accent-700)] text-white hover:bg-[var(--accent-800)] focus:ring-[var(--accent-500)]",
            )}
          >
            {selecting ? (
              <X className="size-6" />
            ) : (
              <ListChecks className="size-6" />
            )}
          </button>

          {selecting && selected.size > 0 ? (
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deletePending}
              aria-label={`${selected.size} ausgewählte Artikel löschen`}
              title={`${selected.size} ausgewählte Artikel löschen`}
              className="inline-flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-stone-950/25 transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {deletePending ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Trash2 className="size-6" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      <Link
        href={newItemHref}
        aria-label={kind === "shop" ? "Eintrag hinzufügen" : "Neuer Artikel"}
        title={kind === "shop" ? "Eintrag hinzufügen" : "Neuer Artikel"}
        className="fixed bottom-[calc(1.25rem_+_env(safe-area-inset-bottom))] right-[calc(1rem_+_env(safe-area-inset-right))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent-700)] text-white shadow-lg shadow-stone-950/20 transition hover:bg-[var(--accent-800)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2 sm:bottom-6 sm:right-6 lg:right-8"
      >
        <Plus className="size-6" />
      </Link>
    </div>
  );
}
