import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ItemForm } from "@/components/item-form";
import { buttonGhost, PageHeader } from "@/components/ui";
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

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; group?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { active } = await requireHousehold();
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
  const product = products.find((entry) => entry.id === item.product_id);
  const itemOnly =
    !groupOnly &&
    item.kind === "stock" &&
    Boolean(item.product_id) &&
    (product?.stockItemCount ?? 0) > 1;

  return (
    <div>
      <PageHeader
        eyebrow={groupOnly ? "Produktgruppe bearbeiten" : "Artikel bearbeiten"}
        title={item.name}
        description={
          groupOnly
            ? "Name, Barcode, Kategorie, Einheit und Foto der Gruppe bearbeiten."
            : itemOnly
              ? "Menge, MHD, Kaufdatum, Lagerort und Notiz bearbeiten. Die Gruppenattribute änderst du über den Stift am Gruppenkopf."
              : item.kind === "shop"
                ? "Eintrag auf der Einkaufsliste bearbeiten."
                : "Menge, Lagerort, Haltbarkeit und Foto bearbeiten."
        }
        action={
          <Link
            href={
              item.kind === "shop" ? "/items?kind=shop" : "/items?kind=stock"
            }
            className={buttonGhost}
          >
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        }
      />

      {!active.canWrite ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Du hast in diesem Haushalt nur Leserechte. Änderungen werden nicht
          gespeichert.
        </p>
      ) : null}

      <ItemForm
        mode="edit"
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
        photoUrl={item.photo_path ? photoUrls.get(item.photo_path) : null}
        canWrite={active.canWrite}
        redirectTo={query.from}
        groupOnly={groupOnly}
      />
    </div>
  );
}
