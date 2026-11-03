import { NewItemDialog } from "@/components/new-item-dialog";
import {
  getCategories,
  getLocations,
  getProducts,
  getPhotoUrls,
  getUnits,
  requireHousehold,
} from "@/lib/data";
import { normalizeBarcode, todayIso } from "@/lib/utils";

type SearchParams = {
  kind?: string;
  barcode?: string;
  from?: string;
};

export default async function NewItemModalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { active } = await requireHousehold();
  const kind = params.kind === "shop" ? "shop" : "stock";
  const barcode = normalizeBarcode(params.barcode).slice(0, 14);

  const [categories, locations, units, products] = await Promise.all([
    getCategories(active.id),
    getLocations(active.id),
    getUnits(active.id),
    getProducts(active.id),
  ]);
  const productPhotoUrls = await getPhotoUrls(products.map((product) => product.photo_path));

  return (
    <NewItemDialog
      kind={kind}
      barcode={barcode}
      categories={categories}
      locations={locations}
      units={units.map((unit) => ({ ...unit, step_size: Number(unit.step_size) }))}
      products={products.map((product) => ({
        ...product,
        photoUrl: product.photo_path ? productPhotoUrls.get(product.photo_path) ?? null : null,
      }))}
      initialPurchasedAt={todayIso()}
      canWrite={active.canWrite}
      redirectTo={params.from}
    />
  );
}
