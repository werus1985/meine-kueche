import { InventoryWorkspace } from "@/components/inventory-workspace";
import type { ItemRow } from "@/components/item-card";
import {
  getCategories,
  getLocations,
  getProducts,
  getQuickFilters,
  getPhotoUrls,
  getUnits,
  requireHousehold,
} from "@/lib/data";
import { cleanupUnusedProducts } from "@/lib/product-cleanup";
import { createClient } from "@/lib/supabase/server";
import { normalizeBarcode } from "@/lib/utils";

type SearchParams = {
  kind?: string;
  barcode?: string;
  created?: string;
  updated?: string;
  product?: string;
  moved?: string;
  deleted?: string;
  cleared?: string;
  error?: string;
};

const itemSelect =
  "id, product_id, name, kind, barcode, qty, expiry, purchased_at, checked, notes, photo_path, photo_url, category_id, location_id, unit_id, updated_at, kitchen_categories(id, name), kitchen_locations(id, name), kitchen_units(id, name, step_size)";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { active } = await requireHousehold();
  const supabase = await createClient();
  const kind = params.kind === "shop" ? "shop" : "stock";

  const [categories, locations, units, products, quickFilters, itemsResult] =
    await Promise.all([
      getCategories(active.id),
      getLocations(active.id),
      getUnits(active.id),
      getProducts(active.id),
      getQuickFilters(active.id),
      supabase
        .from("kitchen_items")
        .select(itemSelect)
        .eq("household_id", active.id)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .range(0, 999),
      // Verwaiste Produktgruppen (>180 Tage ohne Artikel) still aufräumen –
      // parallel, damit es den Seitenaufbau nicht verlängert.
      active.canWrite
        ? cleanupUnusedProducts(active.id)
        : Promise.resolve(),
    ]);

  const rows = (itemsResult.data ?? []) as unknown as ItemRow[];
  const photoUrls = await getPhotoUrls([
    ...rows.map((item) => item.photo_path),
    ...products.map((product) => product.photo_path),
  ]);
  const stockItems = rows
    .filter((item) => item.kind === "stock")
    .map((item) => ({
      ...item,
      updated_at: item.updated_at,
      photoUrl: item.photo_path
        ? photoUrls.get(item.photo_path) ?? null
        : item.photo_url ?? null,
    }));
  const shopItems = rows
    .filter((item) => item.kind === "shop")
    .map((item) => ({
      ...item,
      updated_at: item.updated_at,
      photoUrl: item.photo_path
        ? photoUrls.get(item.photo_path) ?? null
        : item.photo_url ?? null,
    }));
  const inventoryProducts = products.map((product) => ({
    ...product,
    photoUrl: product.photo_path
      ? photoUrls.get(product.photo_path) ?? null
      : product.photo_url ?? null,
  }));

  const barcode = normalizeBarcode(params.barcode);
  // Barcode-Wissen liegt auf den Produkten; Artikel spiegeln es nur.
  const barcodeMissing =
    barcode && !products.some((product) => product.barcode === barcode)
      ? barcode
      : null;

  let status: { message: string; tone: "success" | "error" } | null = null;
  if (params.created) {
    status = {
      message: kind === "shop" ? "Eintrag wurde angelegt." : "Artikel wurde angelegt.",
      tone: "success",
    };
  } else if (params.updated) {
    status = {
      message: kind === "shop" ? "Eintrag wurde gespeichert." : "Artikel wurde gespeichert.",
      tone: "success",
    };
  } else if (params.product) {
    status = {
      message: "Produktgruppe wurde gespeichert.",
      tone: "success",
    };
  } else if (params.moved) {
    status = {
      message:
        params.moved === "0"
          ? "Es waren keine abgehakten Einträge vorhanden."
          : `${params.moved} ${params.moved === "1" ? "Eintrag wurde" : "Einträge wurden"} in den Vorrat verschoben.`,
      tone: "success",
    };
  } else if (params.cleared) {
    status = {
      message:
        params.cleared === "0"
          ? "Die Einkaufsliste war bereits leer."
          : `Einkaufsliste geleert (${params.cleared} ${params.cleared === "1" ? "Eintrag" : "Einträge"}).`,
      tone: "success",
    };
  } else if (params.deleted) {
    const noun = kind === "shop" ? "Eintrag" : "Artikel";
    status = {
      message:
        params.deleted === "0"
          ? "Es war nichts zu löschen."
          : `${params.deleted} ${params.deleted === "1" ? `${noun} wurde` : `${kind === "shop" ? "Einträge" : "Artikel"} wurden`} gelöscht.`,
      tone: "success",
    };
  } else if (params.error) {
    status = {
      message:
        params.error === "keine-berechtigung"
          ? "Du hast in diesem Haushalt nur Leserechte."
          : params.error,
      tone: "error",
    };
  } else if (itemsResult.error) {
    status = { message: "Die Artikel konnten nicht geladen werden.", tone: "error" };
  }

  return (
    <InventoryWorkspace
      initialKind={kind}
      stockItems={stockItems}
      shopItems={shopItems}
      products={inventoryProducts}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      locations={locations.map(({ id, name }) => ({ id, name }))}
      units={units.map(({ id, name }) => ({ id, name }))}
      quickFilters={quickFilters}
      canWrite={active.canWrite}
      status={status}
      barcodeMissing={barcodeMissing}
    />
  );
}
