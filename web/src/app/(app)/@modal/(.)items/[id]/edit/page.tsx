import { notFound } from "next/navigation";

import { EditItemDialog } from "@/components/new-item-dialog";
import {
  getCategories,
  getItem,
  getLocations,
  getProducts,
  getPhotoUrls,
  getUnits,
  requireHousehold,
} from "@/lib/data";
import { todayIso } from "@/lib/utils";

type SearchParams = { from?: string; group?: string };

export default async function EditItemModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query, { active }] = await Promise.all([
    params,
    searchParams,
    requireHousehold(),
  ]);
  const item = await getItem(active.id, id);
  if (!item) notFound();

  // Gruppendetails nur für Artikel mit Gruppen-Verweis; Einzelprodukte
  // behalten das vollständige Formular.
  const groupOnly = query.group === "1" && Boolean(item.product_id);

  const [categories, locations, units, products] = await Promise.all([
    getCategories(active.id),
    getLocations(active.id),
    getUnits(active.id),
    getProducts(active.id),
  ]);
  const photoUrls = await getPhotoUrls([
    item.photo_path,
    ...products.map((product) => product.photo_path),
  ]);

  return (
    <EditItemDialog
      item={{
        id: item.id,
        product_id: item.product_id,
        kind: item.kind,
        name: item.name,
        barcode: item.barcode,
        qty: item.qty,
        unit_id: item.unit_id,
        category_id: item.category_id,
        location_id: item.location_id,
        expiry: item.expiry,
        purchased_at: item.purchased_at,
        checked: item.checked,
        notes: item.notes,
        photo_path: item.photo_path,
        version: item.version,
      }}
      categories={categories}
      locations={locations}
      units={units.map((unit) => ({ ...unit, step_size: Number(unit.step_size) }))}
      products={products.map((product) => ({
        ...product,
        photoUrl: product.photo_path ? photoUrls.get(product.photo_path) ?? null : null,
      }))}
      initialPurchasedAt={todayIso()}
      photoUrl={item.photo_path ? photoUrls.get(item.photo_path) ?? null : null}
      canWrite={active.canWrite}
      redirectTo={query.from}
      groupOnly={groupOnly}
    />
  );
}
