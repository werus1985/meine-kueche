import { saveCategoryRuleAction } from "@/actions/settings";
import { CategoryManager } from "@/components/category-manager";
import { LocationManager } from "@/components/location-manager";
import { ProductGroupManager } from "@/components/product-group-manager";
import { QuickFilterManager } from "@/components/quick-filter-manager";
import { SettingsSection } from "@/components/settings-section";
import { SubmitButton } from "@/components/submit-button";
import { UnitManager } from "@/components/unit-manager";
import { Alert, Card, CardHeader, PageHeader, selectClass } from "@/components/ui";
import {
  getCategories,
  getCategorySettings,
  getLocations,
  getQuickFilters,
  getPhotoUrls,
  getUnits,
  requireHousehold,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  saved?: string;
  deleted?: string;
  error?: string;
  section?: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, { active }, supabase] = await Promise.all([
    searchParams,
    requireHousehold(),
    createClient(),
  ]);

  const [
    categories,
    locations,
    units,
    quickFilters,
    warningSettings,
    itemResult,
    productResult,
  ] = await Promise.all([
      getCategories(active.id),
      getLocations(active.id),
      getUnits(active.id),
      getQuickFilters(active.id),
      getCategorySettings(active.id),
      supabase
        .from("kitchen_items")
        .select("category_id, location_id, unit_id, product_id")
        .eq("household_id", active.id)
        .is("deleted_at", null),
      supabase
        .from("kitchen_products")
        .select("id, name, barcode, category_id, unit_id, photo_path, seasonal")
        .eq("household_id", active.id)
        .order("name", { ascending: true }),
    ]);

  const categoryCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const unitCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  for (const item of itemResult.data ?? []) {
    if (item.category_id)
      categoryCounts.set(item.category_id, (categoryCounts.get(item.category_id) ?? 0) + 1);
    if (item.location_id)
      locationCounts.set(item.location_id, (locationCounts.get(item.location_id) ?? 0) + 1);
    if (item.unit_id)
      unitCounts.set(item.unit_id, (unitCounts.get(item.unit_id) ?? 0) + 1);
    if (item.product_id)
      productCounts.set(item.product_id, (productCounts.get(item.product_id) ?? 0) + 1);
  }
  const settingsByCategory = new Map(
    warningSettings.map((setting) => [setting.category_id, setting]),
  );

  // Nur Gruppen ohne aktive Artikel werden hier verwaltet.
  const unusedProducts = (productResult.data ?? []).filter(
    (product) => (productCounts.get(product.id) ?? 0) === 0,
  );
  const productPhotoUrls = await getPhotoUrls(
    unusedProducts.map((product) => product.photo_path),
  );
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  const unusedProductRows = unusedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    categoryId: product.category_id,
    categoryName: product.category_id
      ? categoryNames.get(product.category_id) ?? null
      : null,
    unitId: product.unit_id,
    unitName: product.unit_id ? unitNames.get(product.unit_id) ?? null : null,
    photoUrl: product.photo_path
      ? productPhotoUrls.get(product.photo_path) ?? null
      : null,
    seasonal: product.seasonal,
  }));

  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Stammdaten" />

      {params.saved ? (
        <div className="mb-3">
          <Alert tone="success">Änderungen wurden gespeichert.</Alert>
        </div>
      ) : null}
      {params.deleted ? (
        <div className="mb-3">
          <Alert tone="success">Eintrag wurde gelöscht und vorhandene Artikel wurden zugeordnet.</Alert>
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-3">
          <Alert tone="error">
            {params.error === "keine-berechtigung"
              ? "Du hast in diesem Haushalt nur Leserechte."
              : params.error}
          </Alert>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <SettingsSection
          id="kategorien"
          title="Kategorien"
          open={params.section === "kategorien"}
        >
          <CategoryManager
            key={`categories-${params.deleted ?? ""}-${params.error ?? ""}`}
            canWrite={active.canWrite}
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              itemCount: categoryCounts.get(category.id) ?? 0,
            }))}
          />
        </SettingsSection>

        <SettingsSection
          id="lagerorte"
          title="Lagerorte"
          open={params.section === "lagerorte"}
        >
          <LocationManager
            key={`locations-${params.deleted ?? ""}-${params.error ?? ""}`}
            canWrite={active.canWrite}
            locations={locations.map((location) => ({
              id: location.id,
              name: location.name,
              itemCount: locationCounts.get(location.id) ?? 0,
            }))}
          />
        </SettingsSection>

        <SettingsSection
          id="einheiten"
          title="Einheiten"
          open={params.section === "einheiten"}
        >
          <UnitManager
            key={`units-${params.deleted ?? ""}-${params.error ?? ""}`}
            canWrite={active.canWrite}
            units={units.map((unit) => ({
              id: unit.id,
              name: unit.name,
              step_size: Number(unit.step_size),
              itemCount: unitCounts.get(unit.id) ?? 0,
            }))}
          />
        </SettingsSection>

        <SettingsSection
          id="produktgruppen"
          title="Produktgruppen"
          open={params.section === "produktgruppen"}
        >
          <ProductGroupManager
            groups={unusedProductRows}
            categories={categories.map(({ id, name }) => ({ id, name }))}
            units={units.map(({ id, name }) => ({ id, name }))}
            canWrite={active.canWrite}
          />
        </SettingsSection>

        <SettingsSection
          id="warnregeln"
          title="Warnregeln"
          open={params.section === "warnregeln"}
        >
          <Card>
              <CardHeader title="Regeln pro Kategorie" />
              {categories.length === 0 ? (
                <p className="px-5 py-5 text-sm text-stone-500">Lege zuerst Kategorien an.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {categories.map((category) => {
                    const setting = settingsByCategory.get(category.id);
                    return (
                      <li key={category.id} className="px-4 py-3">
                        <form action={saveCategoryRuleAction} className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-[minmax(100px,1fr)_100px_145px_135px_auto]">
                          <input type="hidden" name="category_id" value={category.id} />
                          <div className="col-span-2 min-w-0 sm:col-span-1">
                            <p className="text-sm font-medium text-stone-900">{category.name}</p>
                          </div>
                          <div>
                            <label htmlFor={`warning-days-${category.id}`} className="mb-1 block text-xs text-stone-500">
                              Warnung ab
                            </label>
                            <div className="flex items-center gap-1 text-xs text-stone-500">
                              <input
                                id={`warning-days-${category.id}`}
                                name="warning_days"
                                type="number"
                                min="0"
                                max="365"
                                defaultValue={setting?.warning_days ?? 2}
                                disabled={!active.canWrite}
                                className="w-14 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900 disabled:bg-stone-100"
                              />
                              Tage
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`warning-basis-${category.id}`} className="mb-1 block text-xs text-stone-500">
                              Bezug
                            </label>
                            <select
                              id={`warning-basis-${category.id}`}
                              name="warning_basis"
                              defaultValue={setting?.warning_basis ?? "expiry"}
                              disabled={!active.canWrite}
                              className={selectClass}
                            >
                              <option value="expiry">MHD</option>
                              <option value="purchase">Kaufdatum</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`warning-sort-${category.id}`} className="mb-1 block text-xs text-stone-500">
                              Sortierung
                            </label>
                            <select
                              id={`warning-sort-${category.id}`}
                              name="default_sort"
                              defaultValue={setting?.default_sort ?? "auto"}
                              disabled={!active.canWrite}
                              className={selectClass}
                            >
                              <option value="auto">Automatisch</option>
                              <option value="expiry">Haltbarkeit</option>
                              <option value="purchase">Kaufdatum</option>
                              <option value="name">Name</option>
                            </select>
                          </div>
                          {active.canWrite ? (
                            <SubmitButton className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">
                              Speichern
                            </SubmitButton>
                          ) : null}
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
          </Card>
        </SettingsSection>

        <SettingsSection
          id="schnellfilter"
          title="Schnellfilter"
          open={params.section === "schnellfilter"}
        >
          <QuickFilterManager
            key={`quick-filters-${params.deleted ?? ""}-${params.error ?? ""}`}
            canWrite={active.canWrite}
            categories={categories.map(({ id, name }) => ({ id, name }))}
            filters={quickFilters}
          />
        </SettingsSection>
      </div>
    </div>
  );
}
