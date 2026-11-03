"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Save,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";

import { lookupBarcodeAction, type BarcodeLookup } from "@/actions/barcode";
import { saveItemAction, saveProductGroupAction } from "@/actions/items";
import { BarcodeField } from "@/components/barcode-field";
import { CategorySelect } from "@/components/category-select";
import { ExpiryDateField } from "@/components/expiry-date-field";
import { FormMessage } from "@/components/form-message";
import { PhotoLightbox } from "@/components/item-photo";
import { ProductGroupPicker } from "@/components/product-group-picker";
import { PurchasedDateField } from "@/components/purchased-date-field";
import { QtyField } from "@/components/qty-field";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  buttonPrimary,
  buttonSecondary,
  Card,
  inputClass,
  Label,
  selectClass,
  textareaClass,
} from "@/components/ui";
import type { KitchenProduct } from "@/lib/types";
import { cn, normalizeBarcode } from "@/lib/utils";

export type ItemFormValue = {
  id: string;
  product_id: string | null;
  kind: string;
  name: string;
  barcode: string | null;
  qty: number | null;
  unit_id: string | null;
  category_id: string | null;
  location_id: string | null;
  expiry: string | null;
  purchased_at: string | null;
  checked: boolean;
  notes: string;
  photo_path: string | null;
  version: number;
};

type StepKey = "produkt" | "details" | "einlagern" | "menge";

const STEP_TITLES: Record<StepKey, string> = {
  produkt: "Was legst du an?",
  details: "Produktdetails",
  einlagern: "Einlagern",
  menge: "Menge & Notiz",
};

export function ItemForm({
  mode,
  item,
  categories,
  locations,
  units,
  products,
  initialPurchasedAt,
  initialKind = "stock",
  initialBarcode = "",
  photoUrl,
  canWrite = true,
  onCancel,
  redirectTo,
  groupOnly = false,
}: {
  mode: "create" | "edit";
  item?: ItemFormValue | null;
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  units: { id: string; name: string; step_size: number }[];
  products: KitchenProduct[];
  initialPurchasedAt: string;
  initialKind?: "stock" | "shop";
  initialBarcode?: string;
  photoUrl?: string | null;
  canWrite?: boolean;
  onCancel?: () => void;
  redirectTo?: string;
  groupOnly?: boolean;
}) {
  // Gruppendetails gibt es nur bei Artikeln mit Gruppen-Verweis. Einzelne
  // Produkte (ohne Gruppe) behalten immer das vollständige Artikelformular.
  const groupOnlyMode = groupOnly && Boolean(item?.product_id);
  const [state, formAction] = useActionState(
    groupOnlyMode ? saveProductGroupAction : saveItemAction,
    null,
  );
  const kind = item?.kind === "shop" ? "shop" : initialKind;
  const isShopping = kind === "shop";
  const wizard = mode === "create" && !groupOnlyMode;
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const defaultCategoryId =
    categories.find((category) => category.name.toLocaleLowerCase("de-DE") === "allgemein")?.id ?? "";
  // Beim Bearbeiten gewinnt die gespeicherte Gruppe; beim Anlegen (z. B. nach
  // einem Scan) wird der Barcode nach einer bekannten Gruppe aufgelöst.
  const initialProduct =
    products.find((product) => product.id === item?.product_id) ??
    (item?.barcode || initialBarcode
      ? products.find(
          (product) =>
            product.barcode === normalizeBarcode(item?.barcode ?? initialBarcode),
        )
      : undefined);
  const [selectedProductId, setSelectedProductId] = useState(
    initialProduct?.id ?? "",
  );
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );
  const [nameValue, setNameValue] = useState(
    selectedProduct?.name ?? item?.name ?? "",
  );
  const [unitId, setUnitId] = useState(
    initialProduct?.unit_id ?? item?.unit_id ?? "",
  );
  const [seasonal, setSeasonal] = useState(Boolean(initialProduct?.seasonal));
  const [photoLightbox, setPhotoLightbox] = useState(false);
  const [lookup, setLookup] = useState<BarcodeLookup | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [categoryVersion, setCategoryVersion] = useState(0);
  const [step, setStep] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const lookupTimer = useRef<number | null>(null);
  const lookedUp = useRef<Set<string>>(new Set());
  const groupedItem = Boolean(item?.product_id);
  const productFieldsLocked = Boolean(selectedProduct && !groupedItem);
  const productWillBeCreated = Boolean(!selectedProduct);
  // Artikel in einer aufgeklappten Gruppe (≥2 Vorratsartikel): nur die
  // Artikel-Felder bearbeiten. Die Gruppenattribute bleiben unangetastet.
  const itemOnlyMode =
    groupedItem &&
    item?.kind === "stock" &&
    (selectedProduct?.stockItemCount ?? 0) > 1 &&
    !groupOnlyMode;

  useEffect(() => {
    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
  }, []);

  // Effektive Einheit: bei verknüpfter Gruppe deren Einheit, sonst Auswahl.
  const effectiveUnitId = productFieldsLocked
    ? selectedProduct?.unit_id ?? null
    : unitId || null;
  const effectiveUnit = units.find((unit) => unit.id === effectiveUnitId);
  const stepSize = effectiveUnit?.step_size ?? 1;
  const displayPhotoUrl =
    photoUrl ?? selectedProduct?.photoUrl ?? lookup?.photoUrl ?? null;

  // Best Case: nur Barcode/Name + Einlagern. Details nur, wenn wirklich
  // Produktwissen fehlt (neues Produkt ohne externen Treffer).
  const wizardSteps: StepKey[] = !wizard
    ? []
    : isShopping
      ? ["produkt", "menge"]
      : productFieldsLocked || lookup?.found
        ? ["produkt", "einlagern"]
        : ["produkt", "details", "einlagern"];
  const stepIndex = Math.min(step, wizardSteps.length - 1);
  const currentStep = wizardSteps[stepIndex];
  const isLastStep = stepIndex === wizardSteps.length - 1;
  const showDetailsInline = isShopping || Boolean(lookup?.found);

  function applyProductSelection(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;
    // Manuell gewählte Gruppe: externe Vorschläge gelten nicht mehr.
    setLookup(null);
    setLookupPending(false);
    setNameValue(product.name);
    if (product.unit_id) setUnitId(product.unit_id);
  }

  function changeBarcode(value: string) {
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    setLookupPending(false);
    setLookup(null);
    if (groupedItem) return;
    const normalized = normalizeBarcode(value);
    const match = products.find((product) => product.barcode === normalized);
    applyProductSelection(match?.id ?? "");
    // Externer Lookup nur beim Anlegen und nur für lokal unbekannte Barcodes.
    if (!wizard || match || !/^\d{8,14}$/.test(normalized)) {
      return;
    }
    if (lookedUp.current.has(normalized)) return;
    lookupTimer.current = window.setTimeout(() => {
      lookedUp.current.add(normalized);
      setLookupPending(true);
      void lookupBarcodeAction(normalized)
        .then((result) => {
          setLookupPending(false);
          if (!result.found) return;
          setLookup(result);
          if (result.name) setNameValue(result.name);
          if (result.unitId) setUnitId(result.unitId);
          setCategoryVersion((version) => version + 1);
        })
        .catch(() => setLookupPending(false));
    }, 600);
  }

  function goToStep(next: number) {
    const clamped = Math.max(0, Math.min(next, wizardSteps.length - 1));
    setStep(clamped);
    window.requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }

  function goNext() {
    if (currentStep === "produkt" && !productFieldsLocked) {
      if (!nameValue.trim()) {
        nameInputRef.current?.reportValidity();
        return;
      }
    }
    goToStep(stepIndex + 1);
  }

  // --------------------------------------------------------------------------
  // Feld-Bausteine (werden je nach Modus/Schritt anders zusammengesetzt)
  // --------------------------------------------------------------------------

  const productPicker = !groupedItem ? (
    <div className="mb-4">
      <ProductGroupPicker
        products={products}
        categories={categories}
        selectedProductId={selectedProductId}
        onSelect={applyProductSelection}
      />
      {productFieldsLocked && selectedProduct ? (
        <p className="mt-1 text-[11px] text-emerald-800">
          Name, Kategorie, Einheit und Foto werden übernommen ·{" "}
          {selectedProduct.itemCount ?? 0} bestehende Artikel
        </p>
      ) : null}
    </div>
  ) : null;

  const nameField = !productFieldsLocked ? (
    <div className="sm:col-span-2">
      <Label htmlFor="name">Artikelname</Label>
      <input
        ref={nameInputRef}
        id="name"
        name="name"
        required
        maxLength={200}
        value={nameValue}
        onChange={(event) => setNameValue(event.target.value)}
        placeholder="z. B. Vollmilch"
        className={inputClass}
        autoFocus
      />
      {lookup?.found && !lookup.name ? (
        <p className="mt-1 text-[11px] text-amber-800">
          Name fehlt in der Datenbank – bitte selbst eingeben.
        </p>
      ) : null}
    </div>
  ) : null;

  const barcodeField = !productFieldsLocked ? (
    <div className="sm:col-span-2">
      <BarcodeField
        key={`barcode-${selectedProductId || "none"}`}
        defaultValue={selectedProduct?.barcode ?? item?.barcode ?? initialBarcode}
        onValueChange={changeBarcode}
      />
      {lookupPending ? (
        <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-stone-500">
          <Loader2 className="size-3 animate-spin" /> Produktdaten werden gesucht …
        </p>
      ) : lookup?.found ? (
        <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-800">
          <Sparkles className="size-3" />
          Produktdaten gefunden – Name, Kategorie, Einheit und Foto übernommen.
        </p>
      ) : productWillBeCreated ? (
        <p className="mt-1 text-xs text-emerald-800">
          Beim Speichern wird das wiederverwendbare Produktwissen angelegt.
        </p>
      ) : null}
    </div>
  ) : null;

  const seasonalField = (productWillBeCreated || groupedItem) && !itemOnlyMode ? (
    <label className="mt-3 flex items-start gap-2 text-xs text-stone-600">
      <input
        type="checkbox"
        name="seasonal"
        checked={seasonal}
        onChange={(event) => setSeasonal(event.target.checked)}
        className="mt-0.5 size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
      />
      <span>
        Saisonal – vor automatischer Löschung schützen
        <span className="mt-0.5 block text-[11px] text-stone-500">
          Bleibt als Wissen erhalten, bis du die Gruppe löschst.
        </span>
      </span>
    </label>
  ) : null;

  const attributeFields = !productFieldsLocked ? (
    <>
      <div>
        <Label htmlFor="unit_id">Einheit</Label>
        <select
          id="unit_id"
          name="unit_id"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          className={selectClass}
        >
          <option value="">Keine Einheit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.name}</option>
          ))}
        </select>
      </div>
      <CategorySelect
        key={`category-${selectedProductId || "none"}-${categoryVersion}`}
        categories={categories}
        defaultValue={
          selectedProduct?.category_id ??
          lookup?.categoryId ??
          item?.category_id ??
          defaultCategoryId
        }
        canWrite={canWrite}
      />
    </>
  ) : null;

  const qtyField = (
    <QtyField
      defaultValue={item?.qty ?? 0}
      stepSize={stepSize}
      unitName={effectiveUnit?.name ?? null}
    />
  );

  const locationField = (
    <div>
      <Label htmlFor="location_id">Lagerort</Label>
      <select
        id="location_id"
        name="location_id"
        defaultValue={item?.location_id ?? selectedProduct?.last_location_id ?? ""}
        className={selectClass}
      >
        <option value="">Kein Lagerort</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>{location.name}</option>
        ))}
      </select>
    </div>
  );

  const expiryField = <ExpiryDateField defaultValue={item?.expiry ?? ""} />;

  const purchasedField = (
    <PurchasedDateField defaultValue={item?.purchased_at ?? initialPurchasedAt} />
  );

  const notesField = (
    <div className="sm:col-span-2">
      <Label htmlFor="notes">Notizen</Label>
      <textarea
        id="notes"
        name="notes"
        rows={2}
        maxLength={2000}
        defaultValue={item?.notes ?? ""}
        placeholder="z. B. für Kuchen, im Angebot gekauft …"
        className={textareaClass}
      />
    </div>
  );

  const checkedField = isShopping ? (
    <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
      <input
        type="checkbox"
        name="checked"
        defaultChecked={item?.checked ?? false}
        className="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
      />
      Bereits erledigt
    </label>
  ) : null;

  const photoCard = !productFieldsLocked ? (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={() => {
            if (displayPhotoUrl) setPhotoLightbox(true);
            else photoInputRef.current?.click();
          }}
          aria-label={
            displayPhotoUrl ? "Produktfoto vergrößern" : "Produktfoto hinzufügen"
          }
          title={displayPhotoUrl ? "Produktfoto vergrößern" : "Produktfoto hinzufügen"}
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
        >
          {displayPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayPhotoUrl} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <Label htmlFor="photo" hint="max. 5 MB">
            {item?.product_id || productWillBeCreated ? "Produktfotos (für die ganze Gruppe)" : "Produktfoto"}
          </Label>
          <input
            ref={photoInputRef}
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100"
          />
          {lookup?.photoUrl ? (
            <p className="mt-1 text-[11px] text-stone-500">
              Foto aus der Produktdatenbank – ein eigenes Foto ersetzt es.
            </p>
          ) : null}
          {item?.photo_path ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                name="removePhoto"
                value="1"
                className="size-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
              />
              Vorhandenes Foto entfernen
            </label>
          ) : null}
        </div>
      </div>
    </Card>
  ) : null;

  const identityGrid = !productFieldsLocked ? (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {nameField}
      {barcodeField}
    </div>
  ) : null;

  const attributeGrid = !productFieldsLocked ? (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {attributeFields}
    </div>
  ) : null;

  const einlagernGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {qtyField}
      {expiryField}
      {purchasedField}
      {locationField}
      {notesField}
    </div>
  );

  const mengeGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {qtyField}
      {notesField}
      {checkedField}
    </div>
  );

  const wizardHeader = wizard ? (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Schritt {stepIndex + 1} von {wizardSteps.length} · {STEP_TITLES[currentStep]}
      </p>
      <span className="flex gap-1" aria-hidden="true">
        {wizardSteps.map((entry, index) => (
          <span
            key={entry}
            className={cn(
              "size-1.5 rounded-full transition",
              index <= stepIndex ? "bg-[var(--accent-700)]" : "bg-stone-200",
            )}
          />
        ))}
      </span>
    </div>
  ) : null;

  const wizardBody = wizard ? (
    <>
      {/* Alle Schritte bleiben gemountet (hidden), damit Eingaben beim
          Vor-/Zurücknavigieren erhalten bleiben und mitgesendet werden. */}
      <div className={cn(currentStep !== "produkt" && "hidden")}>
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <Badge tone={isShopping ? "neutral" : "green"}>
              {isShopping ? <ShoppingCart className="size-3" /> : <Package className="size-3" />}
              {isShopping ? "Einkaufsliste" : "Vorrat"}
            </Badge>
          </div>
          {productPicker}
          {identityGrid}
          {showDetailsInline && lookup?.found ? (
            <div className="mt-1 border-t border-stone-100 pt-3">
              <p className="mb-2 text-[11px] font-medium text-stone-500">
                Vorschlag aus der Produktdatenbank – anpassbar
              </p>
              {attributeGrid}
            </div>
          ) : null}
          {seasonalField}
        </Card>
        {showDetailsInline && lookup?.found ? photoCard : null}
      </div>

      {!showDetailsInline ? (
        <div className={cn(currentStep !== "details" && "hidden")}>
          <Card className="p-4 sm:p-5">{attributeGrid}</Card>
          {photoCard}
        </div>
      ) : null}

      {!isShopping ? (
        <div className={cn(currentStep !== "einlagern" && "hidden")}>
          <Card className="p-4 sm:p-5">{einlagernGrid}</Card>
        </div>
      ) : (
        <div className={cn(currentStep !== "menge" && "hidden")}>
          <Card className="p-4 sm:p-5">{mengeGrid}</Card>
        </div>
      )}
    </>
  ) : null;

  const groupSummary = selectedProduct ? (
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-stone-50 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-200/60 text-stone-400">
        {displayPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayPhotoUrl} alt="" className="size-full object-cover" />
        ) : (
          <Package className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">
          {selectedProduct.name}
        </p>
        <p className="truncate text-xs text-stone-500">
          {categories.find((category) => category.id === selectedProduct.category_id)?.name ??
            "Allgemein"}
          {" · "}
          {units.find((unit) => unit.id === selectedProduct.unit_id)?.name ??
            "Keine Einheit"}
          {selectedProduct.barcode ? ` · ${selectedProduct.barcode}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-stone-500">
          Gruppenattribute (Name, Foto, Kategorie, Einheit, Barcode) änderst du
          über den Stift am Gruppenkopf.
        </p>
      </div>
    </div>
  ) : null;

  const groupBody = (
    <>
      <Card className="p-4 sm:p-5">
        {groupedItem ? (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Name, Barcode, Kategorie, Einheit und Foto gelten für die ganze
            Produktgruppe ({selectedProduct?.itemCount ?? 1} Artikel).
          </p>
        ) : null}
        {identityGrid}
        {attributeGrid}
        {seasonalField}
      </Card>
      {photoCard}
    </>
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <FormMessage state={state} />

      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {item ? <input type="hidden" name="version" value={item.version} /> : null}
      <input type="hidden" name="kind" value={kind} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {selectedProduct ? (
        <input type="hidden" name="product_id" value={selectedProduct.id} />
      ) : item?.product_id ? (
        <input type="hidden" name="product_id" value={item.product_id} />
      ) : null}
      {wizard && lookup?.found ? (
        <>
          <input type="hidden" name="externalPhotoUrl" value={lookup.photoUrl ?? ""} />
          <input type="hidden" name="externalTags" value={lookup.tags.join(",")} />
        </>
      ) : null}
      {/* Artikel innerhalb einer Gruppe: Gruppenattribute unverändert
          durchreichen, damit der Save-Pfad sie nicht anfasst. */}
      {itemOnlyMode && selectedProduct ? (
        <>
          <input type="hidden" name="name" value={selectedProduct.name} />
          <input type="hidden" name="barcode" value={selectedProduct.barcode ?? ""} />
          <input type="hidden" name="category_id" value={selectedProduct.category_id ?? ""} />
          <input type="hidden" name="unit_id" value={selectedProduct.unit_id ?? ""} />
          <input type="hidden" name="seasonal" value={selectedProduct.seasonal ? "on" : ""} />
        </>
      ) : null}

      {wizardHeader}
      {groupOnlyMode ? (
        groupBody
      ) : wizard ? (
        wizardBody
      ) : itemOnlyMode ? (
        <Card className="p-4 sm:p-5">
          {groupSummary}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {qtyField}
            {locationField}
            {expiryField}
            {purchasedField}
            {checkedField}
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <div className="mb-3">
              <Badge tone={isShopping ? "neutral" : "green"}>
                {isShopping ? <ShoppingCart className="size-3" /> : <Package className="size-3" />}
                {isShopping ? "Einkaufsliste" : "Vorrat"}
              </Badge>
            </div>
            {groupedItem ? (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                Name, Barcode, Kategorie, Einheit und Foto gelten für die ganze Produktgruppe ({selectedProduct?.itemCount ?? 1} Artikel).
              </p>
            ) : null}
            {productPicker}
            {identityGrid}
            {attributeGrid}
            {seasonalField}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {qtyField}
              {locationField}
              {expiryField}
              {purchasedField}
              {checkedField}
            </div>
          </Card>
          {photoCard}
        </>
      )}

      {photoLightbox && displayPhotoUrl ? (
        <PhotoLightbox
          src={displayPhotoUrl}
          alt="Produktfoto"
          onClose={() => setPhotoLightbox(false)}
        />
      ) : null}

      {wizard ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {onCancel ? (
              <button type="button" onClick={onCancel} className={buttonSecondary}>
                <X className="size-4" /> Abbrechen
              </button>
            ) : (
              <Link href={isShopping ? "/items?kind=shop" : "/items?kind=stock"} className={buttonSecondary}>
                <X className="size-4" /> Abbrechen
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => goToStep(stepIndex - 1)}
                className={buttonSecondary}
              >
                <ChevronLeft className="size-4" /> Zurück
              </button>
            ) : null}
            {isLastStep ? (
              <SubmitButton className={buttonPrimary} disabled={!canWrite}>
                <Save className="size-4" />
                {isShopping ? "Eintrag anlegen" : "Artikel anlegen"}
              </SubmitButton>
            ) : (
              <button type="button" onClick={goNext} className={buttonPrimary}>
                Weiter <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <SubmitButton className={buttonPrimary} disabled={!canWrite}>
            <Save className="size-4" />
            Änderungen speichern
          </SubmitButton>
          {onCancel ? (
            <button type="button" onClick={onCancel} className={buttonSecondary}>
              <X className="size-4" /> Abbrechen
            </button>
          ) : (
            <Link href={isShopping ? "/items?kind=shop" : "/items?kind=stock"} className={buttonSecondary}>
              <X className="size-4" /> Abbrechen
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
