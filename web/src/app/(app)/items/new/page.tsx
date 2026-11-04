import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ItemForm } from "@/components/item-form";
import { buttonGhost, PageHeader } from "@/components/ui";
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

export default async function NewItemPage({
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
    <div>
      <PageHeader
        eyebrow="Neuer Artikel"
        title={kind === "shop" ? "Einkauf planen" : "Vorrat erfassen"}
        description={
          kind === "shop"
            ? "Trage ein, was beim nächsten Einkauf mit muss."
            : "Erfasse ein Produkt mit Menge, Lagerort und Haltbarkeit."
        }
        action={
          <Link
            href={kind === "shop" ? "/items?kind=shop" : "/items?kind=stock"}
            className={buttonGhost}
          >
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        }
      />

      {!active.canWrite ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Du hast in diesem Haushalt nur Leserechte. Artikel können nicht
          angelegt werden.
        </p>
      ) : null}

      <ItemForm
        mode="create"
        categories={categories}
        locations={locations}
        units={units.map((unit) => ({ ...unit, step_size: Number(unit.step_size) }))}
        products={products.map((product) => ({
          ...product,
          photoUrl: product.photo_path
            ? productPhotoUrls.get(product.photo_path) ?? null
            : product.photo_url ?? null,
        }))}
        initialPurchasedAt={todayIso()}
        initialKind={kind}
        initialBarcode={barcode}
        canWrite={active.canWrite}
        redirectTo={params.from}
      />
    </div>
  );
}
