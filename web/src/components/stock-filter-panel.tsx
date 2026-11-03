"use client";

import {
  Check,
  ListFilter,
  ScanBarcode,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BarcodeSearchDialog } from "@/components/barcode-search-dialog";
import { SaveQuickFilter } from "@/components/save-quick-filter";
import { inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

type CategoryOption = { id: string; name: string };
type LocationOption = { id: string; name: string };
type QuickFilterOption = {
  id: string;
  name: string;
  categoryIds: string[];
};

function parseIds(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function StockFilterPanel({
  categories,
  locations,
  quickFilters,
  initialCategoryIds,
  initialQuickFilterId,
  canWrite,
}: {
  categories: CategoryOption[];
  locations: LocationOption[];
  quickFilters: QuickFilterOption[];
  initialCategoryIds: string[];
  initialQuickFilterId: string;
  canWrite: boolean;
}) {
  const searchParams = useSearchParams();
  const [scanOpen, setScanOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const closeScanner = useCallback(() => setScanOpen(false), []);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchParamsRef = useRef<URLSearchParams | ReadonlyURLSearchParams>(
    searchParams,
  );
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const qParam = searchParams.get("q") ?? searchParams.get("barcode") ?? "";
  const categoryParam = searchParams.get("category");
  const explicitCategoryIds = useMemo(
    () => parseIds(categoryParam),
    [categoryParam],
  );
  const categoryNoneSelected = explicitCategoryIds.includes("__none__");
  const quickFilterId =
    searchParams.get("quickFilter") ?? initialQuickFilterId;
  const quickFilter = quickFilters.find(
    (filter) => filter.id === quickFilterId,
  );
  const selectedCategoryIds = useMemo(
    () =>
      categoryNoneSelected
        ? []
        : explicitCategoryIds.length > 0
        ? explicitCategoryIds
        : categoryParam === null && initialCategoryIds.length > 0
          ? initialCategoryIds
          : (quickFilter?.categoryIds ?? []),
    [
      explicitCategoryIds,
      categoryNoneSelected,
      categoryParam,
      initialCategoryIds,
      quickFilter,
    ],
  );
  const locationIds = useMemo(
    () => parseIds(searchParams.get("location")),
    [searchParams],
  );
  const sort = searchParams.get("sort") ?? "expiry";
  const expired = searchParams.get("expired") === "1";
  const expiring = searchParams.get("expiring") === "1";
  const [query, setQuery] = useState(qParam);
  const lastAppliedQuery = useRef(qParam);

  const apply = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    params.delete("barcode");
    mutate(params);
    const queryString = params.toString();
    searchParamsRef.current = params;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`,
    );
  }, []);

  useEffect(() => {
    if (qParam === lastAppliedQuery.current) return;
    lastAppliedQuery.current = qParam;
    setQuery(qParam);
  }, [qParam]);

  useEffect(() => {
    if (!filterOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  function updateQuery(value: string) {
    setQuery(value);
    lastAppliedQuery.current = value;
    apply((params) => {
      if (value) params.set("q", value);
      else params.delete("q");
    });
  }

  function clearSearch() {
    updateQuery("");
  }

  function clearAllFilters() {
    setQuery("");
    lastAppliedQuery.current = "";
    apply((params) => {
      for (const key of [
        "q",
        "barcode",
        "category",
        "location",
        "quickFilter",
        "sort",
        "expired",
        "expiring",
        "from",
      ]) {
        params.delete(key);
      }
    });
  }

  function toggleCategory(categoryId: string) {
    const next = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    apply((params) => {
      params.delete("quickFilter");
      if (next.length) params.set("category", next.join(","));
      else params.delete("category");
    });
  }

  function invertCategories() {
    const selected = new Set(selectedCategoryIds);
    const inverted = categories
      .filter((category) => !selected.has(category.id))
      .map((category) => category.id);
    apply((params) => {
      params.delete("quickFilter");
      params.set(
        "category",
        inverted.length ? inverted.join(",") : "__none__",
      );
    });
  }

  function clearCategories() {
    apply((params) => {
      params.delete("category");
      params.delete("quickFilter");
    });
  }

  function toggleLocation(locationId: string) {
    const next = locationIds.includes(locationId)
      ? locationIds.filter((id) => id !== locationId)
      : [...locationIds, locationId];
    apply((params) => {
      if (next.length) params.set("location", next.join(","));
      else params.delete("location");
    });
  }

  function applyQuickFilter(filter: QuickFilterOption) {
    if (!filter.categoryIds.length) return;
    // Erneutes Antippen des aktiven Filters hebt ihn wieder auf.
    const active = quickFilterId === filter.id;
    apply((params) => {
      if (active) {
        params.delete("quickFilter");
        params.delete("category");
        return;
      }
      params.set("category", filter.categoryIds.join(","));
      params.set("quickFilter", filter.id);
    });
  }

  function handleBarcode(code: string) {
    updateQuery(code);
    setScanOpen(false);
  }

  const hasActiveFilters =
    Boolean(qParam) ||
    selectedCategoryIds.length > 0 ||
    categoryNoneSelected ||
    locationIds.length > 0 ||
    Boolean(quickFilterId) ||
    sort !== "expiry" ||
    expired ||
    expiring;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Name, Notiz oder Barcode …"
            className={cn(
              inputClass,
              "border-white/70 bg-white/75 pl-9 pr-10 shadow-md shadow-stone-900/5 backdrop-blur-xl",
            )}
            aria-label="Artikel durchsuchen"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Suche leeren"
              title="Suche leeren"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFilterOpen(false);
                setScanOpen(true);
              }}
              aria-label="Barcode für die Suche scannen"
              title="Barcode für die Suche scannen"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-[var(--accent-700)]"
            >
              <ScanBarcode className="size-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          aria-label={hasActiveFilters ? "Filter (aktiv)" : "Filter öffnen"}
          aria-expanded={filterOpen}
          aria-haspopup="dialog"
          title={hasActiveFilters ? "Filter aktiv – Filter öffnen" : "Filter öffnen"}
          className={cn(
            "relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-md backdrop-blur-xl transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2",
            hasActiveFilters
              ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-white hover:bg-[var(--accent-800)]"
              : "border-white/70 bg-white/75 text-stone-600 hover:bg-white",
          )}
        >
          <ListFilter className="size-4" />
          {hasActiveFilters ? (
            <span className="absolute right-1 top-1 size-2 rounded-full border border-white bg-amber-300" />
          ) : null}
        </button>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAllFilters}
            aria-label="Alle Filter zurücksetzen"
            title="Alle Filter zurücksetzen"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/75 text-stone-600 shadow-md backdrop-blur-xl transition hover:bg-white hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {filterOpen ? (
        <div
          role="dialog"
          aria-label="Filter"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(72dvh,42rem)] w-[min(92vw,34rem)] overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-2xl shadow-stone-950/20 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900">Filter</h2>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
              >
                Alle Filter zurücksetzen
              </button>
            ) : null}
          </div>

          <section className="border-t border-stone-100 py-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Sortierung
            </h3>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
              {[
                ["expiry", "Haltbarkeit"],
                ["name", "Name"],
                ["updated", "Zuletzt geändert"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() =>
                    apply((params) => {
                      if (value === "expiry") params.delete("sort");
                      else params.set("sort", value);
                    })
                  }
                  className={cn(
                    "rounded-lg px-2 py-2 text-xs font-medium transition",
                    sort === value
                      ? "bg-white text-[var(--accent-800)] shadow-sm"
                      : "text-stone-600 hover:text-stone-900",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="border-t border-stone-100 py-3">
            <div className="mb-2 flex items-center gap-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Lagerorte
              </h3>
            </div>
            {locations.length === 0 ? (
              <p className="text-sm text-stone-500">Noch keine Lagerorte angelegt.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={locationIds.length === 0}
                  onClick={() => apply((params) => params.delete("location"))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    locationIds.length === 0
                      ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-[var(--accent-300)]",
                  )}
                >
                  {locationIds.length === 0 ? <Check className="size-3" /> : null}
                  Alle
                </button>
                {locations.map((location) => {
                  const selected = locationIds.includes(location.id);
                  return (
                    <button
                      key={location.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleLocation(location.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        selected
                          ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-[var(--accent-300)]",
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                      {location.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t border-stone-100 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Kategorien
              </h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={invertCategories}
                  disabled={categories.length === 0}
                  className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline disabled:opacity-40"
                >
                  Auswahl umkehren
                </button>
                {selectedCategoryIds.length > 0 || categoryNoneSelected || quickFilterId ? (
                  <button
                    type="button"
                    onClick={clearCategories}
                    className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                  >
                    Alle anzeigen
                  </button>
                ) : null}
              </div>
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-stone-500">Noch keine Kategorien angelegt.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const selected = selectedCategoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        selected
                          ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-white shadow-sm"
                          : "border-stone-200 bg-white text-stone-600 hover:border-[var(--accent-300)] hover:text-stone-900",
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {canWrite && selectedCategoryIds.length > 0 ? (
            <SaveQuickFilter
              key={selectedCategoryIds.join(",")}
              categoryIds={selectedCategoryIds}
            />
          ) : null}

          {quickFilters.length > 0 ? (
            <section className="border-t border-stone-100 py-3">
              <h3 className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <Sparkles className="size-3.5" /> Schnellfilter
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={quickFilterId === filter.id}
                    onClick={() => applyQuickFilter(filter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      quickFilterId === filter.id
                        ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-[var(--accent-300)]",
                    )}
                  >
                    {filter.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {scanOpen ? (
        <BarcodeSearchDialog
          onClose={closeScanner}
          onDetected={handleBarcode}
        />
      ) : null}
    </div>
  );
}
