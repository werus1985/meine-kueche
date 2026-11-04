"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getActiveHousehold } from "@/lib/data";
import { isAllowedExternalPhotoUrl } from "@/lib/barcode-lookup";
import { normalizeExpiryInput } from "@/lib/date-input";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import {
  importExternalPhoto,
  removePhoto,
  uploadPhoto,
} from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import { normalizeBarcode, todayIso } from "@/lib/utils";

/**
 * Lädt ein externes Produktfoto nach der Antwort in den eigenen Storage.
 * OFF liefert Bilder oft erst nach 10–25 s – der Nutzer wartet nicht darauf.
 */
function scheduleExternalPhotoImport(params: {
  householdId: string;
  table: "kitchen_items" | "kitchen_products";
  targetId: string;
  url: string;
  accessToken: string | null;
}) {
  if (!params.accessToken) return;

  after(async () => {
    try {
      const client = createSupabaseClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          global: { headers: { Authorization: `Bearer ${params.accessToken}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const imported = await importExternalPhoto(
        params.householdId,
        params.targetId,
        params.url,
        client,
      );
      if (!imported) return;
      await client
        .from(params.table)
        .update({ photo_path: imported, photo_url: null })
        .eq("id", params.targetId)
        .eq("household_id", params.householdId);
    } catch {
      // Best effort – das externe Bild bleibt als Fallback gespeichert.
    }
  });
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

/**
 * MHD-Eingabe (Textfeld: „15.10.2026“, „15102026“, Diktat) in ISO umwandeln.
 * `invalid` markiert eine nicht leerbare, aber unlesbare Eingabe.
 */
function parseExpiryField(value: FormDataEntryValue | null) {
  const raw = optionalText(value);
  if (!raw) return { iso: null, invalid: false };
  const parsed = normalizeExpiryInput(raw);
  return parsed ? { iso: parsed.iso, invalid: false } : { iso: null, invalid: true };
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").replace(",", ".").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function safeItemsRedirect(
  value: FormDataEntryValue | null,
  fallback: string,
) {
  const text = String(value ?? "").trim();
  if (
    text === "/items" ||
    text.startsWith("/items?") ||
    text.startsWith("/items#")
  ) {
    return text;
  }
  return fallback;
}

function withStatusFlag(target: string, flag: string) {
  const [pathAndQuery, hash] = target.split("#");
  const url = new URL(pathAndQuery, "http://localhost");
  for (const key of ["created", "updated", "moved", "error", "product"]) {
    url.searchParams.delete(key);
  }
  url.searchParams.set(flag, "1");
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}

/**
 * Merkt sich, welcher externen Kategorie die gewählte Haushaltskategorie
 * entspricht. Beim nächsten Barcode mit denselben Tags gewinnt dieses
 * gelernte Mapping (user-basiert, pro Haushalt).
 */
async function rememberExternalMapping(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  formData: FormData,
  categoryId: string | null,
  unitId: string | null,
) {
  if (!categoryId && !unitId) return;
  const raw = String(formData.get("externalTags") ?? "").trim();
  if (!raw) return;
  const tags = [
    ...new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().slice(0, 200))
        .filter((tag) => tag.length >= 2),
    ),
  ].slice(0, 20);
  if (tags.length === 0) return;

  const { error: mappingError } = await supabase
    .from("external_product_mappings")
    .upsert(
      tags.map((tag) => ({
        household_id: householdId,
        source: "openfoodfacts",
        tag,
        category_id: categoryId,
        unit_id: unitId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "household_id,source,tag" },
    );
  if (mappingError) {
    console.error("rememberExternalMapping", mappingError.message);
  }
}

export async function saveItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    return {
      ok: false,
      message: "Du hast in diesem Haushalt nur Leserechte.",
    };
  }

  const id = optionalText(formData.get("id"));
  const kind = String(formData.get("kind") ?? "stock");
  const submittedName = String(formData.get("name") ?? "").trim();
  const barcodeRaw = normalizeBarcode(String(formData.get("barcode") ?? ""));
  let barcode = barcodeRaw.length > 0 ? barcodeRaw : null;

  if (!["stock", "shop"].includes(kind)) {
    return { ok: false, message: "Ungültiger Artikeltyp." };
  }
  const redirectTo = safeItemsRedirect(
    formData.get("redirectTo"),
    kind === "shop" ? "/items?kind=shop" : "/items?kind=stock",
  );
  if (barcode && !/^\d{8,14}$/.test(barcode)) {
    return {
      ok: false,
      message: "Ein Barcode muss aus 8 bis 14 Ziffern bestehen.",
    };
  }

  const expiryField = parseExpiryField(formData.get("expiry"));
  if (expiryField.invalid) {
    return {
      ok: false,
      message:
        "Bitte das MHD als Datum eingeben – z. B. 15.10.2026 oder 15102026.",
    };
  }

  const supabase = await createClient();
  const existingResult = id
    ? await supabase
        .from("kitchen_items")
        .select("id, household_id, product_id, version, photo_path, photo_url, barcode, name, category_id, unit_id, notes")
        .eq("id", id)
        .eq("household_id", context.active.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) {
    return { ok: false, message: existingResult.error.message };
  }
  if (id && !existingResult.data) {
    return { ok: false, message: "Der Artikel wurde nicht gefunden. Bitte neu laden." };
  }
  const existing = existingResult.data;

  // Notizen werden direkt auf der Karte gepflegt. Fehlt das Feld im Formular
  // (Bearbeiten-Dialog), bleibt der bestehende Wert unverändert.
  const notesEntry = formData.get("notes");
  const notes =
    notesEntry !== null
      ? String(notesEntry).trim().slice(0, 2000)
      : existing?.notes ?? "";

  let productId = existing?.product_id ?? optionalText(formData.get("product_id"));
  let productCreated = false;
  let product: {
    id: string;
    household_id: string;
    barcode: string | null;
    name: string;
    category_id: string | null;
    unit_id: string | null;
    last_location_id: string | null;
    photo_path: string | null;
    photo_url: string | null;
    seasonal: boolean;
  } | null = null;

  if (productId) {
    const { data, error } = await supabase
      .from("kitchen_products")
      .select("id, household_id, barcode, name, category_id, unit_id, last_location_id, photo_path, photo_url, seasonal")
      .eq("id", productId)
      .eq("household_id", context.active.id)
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, message: "Die ausgewählte Produktgruppe wurde nicht gefunden." };
    product = data;
    barcode = existing?.product_id ? barcode : product.barcode;
  }

  // Jeder Artikel gehört zu einer Produktgruppe: Fehlt der Verweis, wird
  // immer eine Gruppe gesucht/angelegt (auch beim Bearbeiten von Altdaten).
  const shouldCreateProduct = !productId;
  if (!product && shouldCreateProduct) {
    const { data, error } = await supabase.rpc("find_or_create_kitchen_product", {
      p_household_id: context.active.id,
      p_barcode: barcode as string,
      p_name: submittedName,
      p_category_id: optionalText(formData.get("category_id")) as string,
      p_unit_id: optionalText(formData.get("unit_id")) as string,
    });
    if (error) return { ok: false, message: error.message };
    const result = Array.isArray(data) ? data[0] : data;
    productId = result?.product_id ?? null;
    productCreated = result?.created ?? false;
    if (!productId) {
      return { ok: false, message: "Produktgruppe konnte nicht angelegt werden." };
    }
    const { data: found, error: productError } = await supabase
      .from("kitchen_products")
      .select("id, household_id, barcode, name, category_id, unit_id, last_location_id, photo_path, photo_url, seasonal")
      .eq("id", productId)
      .eq("household_id", context.active.id)
      .single();
    if (productError) return { ok: false, message: productError.message };
    product = found;
    barcode = product.barcode;

    // Saisonal-Schutz: nur bei frisch angelegten Gruppen setzen, damit
    // bestehendes Gruppenwissen nicht versehentlich umgeschaltet wird.
    if (productCreated) {
      const seasonal = formData.get("seasonal") === "on";
      if (seasonal) {
        const { error: seasonalError } = await supabase
          .from("kitchen_products")
          .update({ seasonal: true })
          .eq("id", productId)
          .eq("household_id", context.active.id);
        if (seasonalError) return { ok: false, message: seasonalError.message };
        product = { ...product, seasonal: true };
      }
    }
  }

  const groupedEdit = Boolean(existing?.product_id);
  const isLinkedToProduct = Boolean(productId && product);
  const name = isLinkedToProduct && !groupedEdit ? product!.name : submittedName;
  if (name.length < 1) {
    return { ok: false, message: "Bitte einen Artikelnamen eingeben." };
  }

  const values = {
    kind,
    name,
    barcode: isLinkedToProduct && !groupedEdit ? product!.barcode : barcode,
    qty: optionalNumber(formData.get("qty")) ?? (id ? null : 0),
    unit_id:
      isLinkedToProduct && !groupedEdit
        ? product!.unit_id
        : optionalText(formData.get("unit_id")),
    category_id:
      isLinkedToProduct && !groupedEdit
        ? product!.category_id
        : optionalText(formData.get("category_id")),
    location_id: optionalText(formData.get("location_id")),
    expiry: expiryField.iso,
    purchased_at: optionalText(formData.get("purchased_at")) ?? (id ? null : todayIso()),
    notes,
    checked: kind === "shop" ? formData.get("checked") === "on" : false,
  };

  const photo = formData.get("photo");
  const removeExistingPhoto = formData.get("removePhoto") === "1";

  if (id && productId && productCreated && photo instanceof File && photo.size > 0) {
    const upload = await uploadPhoto(context.active.id, productId, photo);
    if (upload.error) return { ok: false, message: upload.error };
    const path = upload.path ?? null;
    if (path) {
      const { error } = await supabase
        .from("kitchen_products")
        .update({ photo_path: path })
        .eq("id", productId)
        .eq("household_id", context.active.id);
      if (error) {
        await removePhoto(path);
        return { ok: false, message: error.message };
      }
      product = { ...product!, photo_path: path };
    }
  }

  if (groupedEdit && existing && product) {
    let productPhotoPath = product.photo_path;
    let uploadedProductPhoto: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      const upload = await uploadPhoto(context.active.id, product.id, photo);
      if (upload.error) return { ok: false, message: upload.error };
      uploadedProductPhoto = upload.path ?? null;
      if (uploadedProductPhoto) productPhotoPath = uploadedProductPhoto;
    } else if (removeExistingPhoto) {
      productPhotoPath = null;
    }

    const { error } = await supabase.rpc("update_kitchen_product_item", {
      p_household_id: context.active.id,
      p_item_id: existing.id,
      p_expected_version: Number(formData.get("version") ?? existing.version),
      p_name: submittedName,
      p_barcode: barcode as string,
      p_category_id: optionalText(formData.get("category_id")) as string,
      p_unit_id: optionalText(formData.get("unit_id")) as string,
      p_photo_path: productPhotoPath as string,
      p_qty: optionalNumber(formData.get("qty")) as number,
      p_location_id: optionalText(formData.get("location_id")) as string,
      p_expiry: expiryField.iso as string,
      p_purchased_at: optionalText(formData.get("purchased_at")) as string,
      p_notes: notes,
      p_checked: kind === "shop" && formData.get("checked") === "on",
    });
    if (error) {
      if (uploadedProductPhoto) await removePhoto(uploadedProductPhoto);
      return { ok: false, message: error.message };
    }

    // Saisonal-Schutz ist ein Gruppenattribut und wird im Gruppen-Edit
    // mitgespeichert.
    if (!existing.product_id) {
      return { ok: false, message: "Produktgruppe fehlt." };
    }
    const { error: seasonalError } = await supabase
      .from("kitchen_products")
      .update({ seasonal: formData.get("seasonal") === "on" })
      .eq("id", existing.product_id)
      .eq("household_id", context.active.id);
    if (seasonalError) {
      return { ok: false, message: seasonalError.message };
    }

    if (product.photo_path && product.photo_path !== productPhotoPath) {
      await removePhoto(product.photo_path);
    }
    if (uploadedProductPhoto || removeExistingPhoto) {
      await supabase
        .from("kitchen_products")
        .update({ photo_url: null })
        .eq("id", product.id)
        .eq("household_id", context.active.id);
    }
    revalidatePath("/", "layout");
    redirect(withStatusFlag(redirectTo, "updated"));
  }

  if (!id) {
    const ownPhoto = photo instanceof File && photo.size > 0;
    const externalPhotoUrlRaw = String(
      formData.get("externalPhotoUrl") ?? "",
    ).trim();
    const externalPhotoUrl = isAllowedExternalPhotoUrl(externalPhotoUrlRaw)
      ? externalPhotoUrlRaw
      : null;
    let productPhotoPath = product?.photo_path ?? null;
    let productPhotoUrl = product?.photo_url ?? null;

    if (productId && ownPhoto) {
      // Eigenes Foto ersetzt einen eventuellen externen Fallback.
      if (productCreated) {
        const upload = await uploadPhoto(context.active.id, productId, photo);
        if (upload.error) return { ok: false, message: upload.error };
        productPhotoPath = upload.path ?? null;
        if (productPhotoPath) {
          const { error: photoError } = await supabase
            .from("kitchen_products")
            .update({ photo_path: productPhotoPath, photo_url: null })
            .eq("id", productId)
            .eq("household_id", context.active.id);
          if (photoError) {
            await removePhoto(productPhotoPath);
            return { ok: false, message: photoError.message };
          }
        }
      }
      productPhotoUrl = null;
    } else if (
      productId &&
      !ownPhoto &&
      externalPhotoUrl &&
      !productPhotoPath &&
      !productPhotoUrl
    ) {
      // Externes Bild sofort verfügbar machen; Download läuft im Hintergrund.
      const { error: photoError } = await supabase
        .from("kitchen_products")
        .update({ photo_url: externalPhotoUrl })
        .eq("id", productId)
        .eq("household_id", context.active.id);
      if (!photoError) productPhotoUrl = externalPhotoUrl;
    }

    const { data: inserted, error } = await supabase
      .from("kitchen_items")
      .insert({
        ...values,
        household_id: context.active.id,
        product_id: productId,
        photo_path: productId ? productPhotoPath : null,
        photo_url: productId
          ? productPhotoUrl
          : ownPhoto
            ? null
            : externalPhotoUrl,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!productId && ownPhoto) {
      const upload = await uploadPhoto(context.active.id, inserted.id, photo);
      if (upload.error) {
        return { ok: false, message: upload.error };
      }
      if (upload.path) {
        const { error: photoError } = await supabase
          .from("kitchen_items")
          .update({ photo_path: upload.path, photo_url: null })
          .eq("id", inserted.id);
        if (photoError) return { ok: false, message: photoError.message };
      }
    }

    // Lokale Kopie im Hintergrund ziehen (OFF ist oft 10–25 s langsam).
    if (!ownPhoto && externalPhotoUrl) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      scheduleExternalPhotoImport({
        householdId: context.active.id,
        table: productId ? "kitchen_products" : "kitchen_items",
        targetId: productId ?? inserted.id,
        url: externalPhotoUrl,
        accessToken: session?.access_token ?? null,
      });
    }

    await rememberExternalMapping(
      supabase,
      context.active.id,
      formData,
      values.category_id,
      values.unit_id,
    );

    revalidatePath("/", "layout");
    redirect(withStatusFlag(redirectTo, "created"));
  }

  const versionRaw = optionalNumber(formData.get("version"));
  const version = versionRaw !== null ? Math.trunc(versionRaw) : null;

  let query = supabase
    .from("kitchen_items")
    .update({
      ...values,
      product_id: productId,
      photo_path: productId ? product?.photo_path ?? null : existing?.photo_path,
      photo_url: productId
        ? product?.photo_url ?? null
        : removeExistingPhoto
          ? null
          : existing?.photo_url ?? null,
    })
    .eq("id", id)
    .eq("household_id", context.active.id)
    .is("deleted_at", null);

  if (version !== null) {
    query = query.eq("version", version);
  }

  const { data: updated, error } = await query
    .select("id, photo_path")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!updated) {
    return {
      ok: false,
      message:
        "Der Artikel wurde inzwischen von jemand anderem geändert. Bitte Seite neu laden.",
    };
  }

  if (productId && product && existing && existing.photo_path !== product.photo_path) {
    await removePhoto(existing.photo_path);
  } else if (!productId && photo instanceof File && photo.size > 0) {
    const upload = await uploadPhoto(context.active.id, updated.id, photo);
    if (upload.error) return { ok: false, message: upload.error };
    if (upload.path) {
      const { error: photoError } = await supabase
        .from("kitchen_items")
        .update({ photo_path: upload.path })
        .eq("id", updated.id);
      if (photoError) return { ok: false, message: photoError.message };
      await removePhoto(updated.photo_path);
    }
  } else if (!productId && removeExistingPhoto) {
    const { error: photoError } = await supabase
      .from("kitchen_items")
      .update({ photo_path: null })
      .eq("id", updated.id);
    if (photoError) return { ok: false, message: photoError.message };
    await removePhoto(updated.photo_path);
  }

  await rememberExternalMapping(
    supabase,
    context.active.id,
    formData,
    values.category_id,
    values.unit_id,
  );

  revalidatePath("/", "layout");
  redirect(withStatusFlag(redirectTo, "updated"));
}

/**
 * Speichert ausschließlich die Gruppendetails (Name, Barcode, Kategorie,
 * Einheit, Foto, Saisonal). Wird über den Stift an der Gruppenkarte genutzt
 * und fasst bewusst keine Artikel-Felder (Menge, MHD, …) an.
 */
export async function saveProductGroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const productId = optionalText(formData.get("product_id"));
  if (!productId) return { ok: false, message: "Produktgruppe fehlt." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 200) {
    return { ok: false, message: "Bitte einen Namen mit maximal 200 Zeichen eingeben." };
  }
  const barcode = normalizeBarcode(String(formData.get("barcode") ?? "")) || null;
  if (barcode && !/^\d{8,14}$/.test(barcode)) {
    return { ok: false, message: "Ein Barcode muss aus 8 bis 14 Ziffern bestehen." };
  }

  const redirectTo = safeItemsRedirect(
    formData.get("redirectTo"),
    "/items?kind=stock",
  );

  const supabase = await createClient();
  const { data: product, error: loadError } = await supabase
    .from("kitchen_products")
    .select("id, photo_path")
    .eq("id", productId)
    .eq("household_id", context.active.id)
    .maybeSingle();
  if (loadError) return { ok: false, message: loadError.message };
  if (!product) return { ok: false, message: "Produktgruppe wurde nicht gefunden." };

  const photo = formData.get("photo");
  const removeExistingPhoto = formData.get("removePhoto") === "1";
  let photoPath = product.photo_path;

  if (photo instanceof File && photo.size > 0) {
    const upload = await uploadPhoto(context.active.id, product.id, photo);
    if (upload.error) return { ok: false, message: upload.error };
    if (upload.path) {
      photoPath = upload.path;
      await removePhoto(product.photo_path);
    }
  } else if (removeExistingPhoto) {
    photoPath = null;
    await removePhoto(product.photo_path);
  }

  const { error } = await supabase
    .from("kitchen_products")
    .update({
      name,
      barcode,
      category_id: optionalText(formData.get("category_id")),
      unit_id: optionalText(formData.get("unit_id")),
      photo_path: photoPath,
      seasonal: formData.get("seasonal") === "on",
    })
    .eq("id", productId)
    .eq("household_id", context.active.id);

  if (error) {
    if (photoPath && photoPath !== product.photo_path) {
      await removePhoto(photoPath);
    }
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Dieser Barcode ist bereits einer anderen Gruppe zugeordnet."
          : error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect(withStatusFlag(redirectTo, "product"));
}

export async function setItemNotesAction(
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return { ok: false, message: "Artikel fehlt." };
  if (notes.length > 2000) {
    return { ok: false, message: "Notizen dürfen höchstens 2000 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_items")
    .update({ notes })
    .eq("id", id)
    .eq("household_id", context.active.id)
    .is("deleted_at", null);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  return { ok: true, message: "Notiz gespeichert." };
}

/**
 * Foto direkt aus der Karte setzen. Bei verknüpften Artikeln ist das Foto ein
 * Gruppenattribut und wird auf dem Produkt gespeichert.
 */
export async function uploadItemPhotoAction(
  formData: FormData,
): Promise<FormState> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const itemId = String(formData.get("itemId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Bitte ein Foto auswählen." };
  }

  const supabase = await createClient();

  if (productId) {
    const { data: product, error } = await supabase
      .from("kitchen_products")
      .select("id, photo_path")
      .eq("id", productId)
      .eq("household_id", context.active.id)
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!product) return { ok: false, message: "Produktgruppe nicht gefunden." };

    const upload = await uploadPhoto(context.active.id, product.id, file);
    if (upload.error) return { ok: false, message: upload.error };
    if (!upload.path) return { ok: false, message: "Foto konnte nicht gespeichert werden." };

    const { error: updateError } = await supabase
      .from("kitchen_products")
      .update({ photo_path: upload.path })
      .eq("id", product.id)
      .eq("household_id", context.active.id);
    if (updateError) {
      await removePhoto(upload.path);
      return { ok: false, message: updateError.message };
    }
    await removePhoto(product.photo_path);
    revalidatePath("/", "layout");
    revalidatePath("/items");
    return { ok: true, message: "Produktfoto gespeichert." };
  }

  if (!itemId) return { ok: false, message: "Artikel fehlt." };

  const { data: item, error: itemError } = await supabase
    .from("kitchen_items")
    .select("id, product_id, photo_path")
    .eq("id", itemId)
    .eq("household_id", context.active.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (itemError) return { ok: false, message: itemError.message };
  if (!item) return { ok: false, message: "Artikel nicht gefunden." };

  // Gruppenfoto gilt für alle Artikel der Gruppe.
  if (item.product_id) {
    const next = new FormData();
    next.set("productId", item.product_id);
    next.set("photo", file);
    return uploadItemPhotoAction(next);
  }

  const upload = await uploadPhoto(context.active.id, item.id, file);
  if (upload.error) return { ok: false, message: upload.error };
  if (!upload.path) return { ok: false, message: "Foto konnte nicht gespeichert werden." };

  const { error: updateError } = await supabase
    .from("kitchen_items")
    .update({ photo_path: upload.path, photo_url: null })
    .eq("id", item.id)
    .eq("household_id", context.active.id);
  if (updateError) {
    await removePhoto(upload.path);
    return { ok: false, message: updateError.message };
  }
  await removePhoto(item.photo_path);
  revalidatePath("/", "layout");
  revalidatePath("/items");
  return { ok: true, message: "Foto gespeichert." };
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) redirect("/items?error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/items");

  const supabase = await createClient();
  await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", context.active.id);

  revalidatePath("/", "layout");
  // Nur interne Pfade erlauben; "//evil.example" wäre ein Open Redirect.
  const redirectTo = String(formData.get("redirectTo") ?? "");
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/items";
  redirect(safeRedirect);
}

const BULK_DELETE_LIMIT = 500;

/** Batch-Löschen: ausgewählte Vorratsartikel in einem Rutsch entfernen. */
export async function deleteItemsAction(ids: string[]): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) redirect("/items?error=keine-berechtigung");

  const unique = [
    ...new Set(
      (Array.isArray(ids) ? ids : []).filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ].slice(0, BULK_DELETE_LIMIT);
  if (unique.length === 0) redirect("/items?kind=stock");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", unique)
    .eq("household_id", context.active.id)
    .eq("kind", "stock")
    .is("deleted_at", null)
    .select("id");

  if (error) {
    redirect(`/items?kind=stock&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(`/items?kind=stock&deleted=${data?.length ?? 0}`);
}

/** Alle abgehakten Einkaufs-Einträge löschen. */
export async function deleteCheckedShoppingAction(): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    redirect("/items?kind=shop&error=keine-berechtigung");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .eq("checked", true)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    redirect(`/items?kind=shop&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(`/items?kind=shop&deleted=${data?.length ?? 0}`);
}

/** Komplette Einkaufsliste (offen und erledigt) leeren. */
export async function clearShoppingListAction(): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    redirect("/items?kind=shop&error=keine-berechtigung");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .is("deleted_at", null)
    .select("id");

  if (error) {
    redirect(`/items?kind=shop&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(`/items?kind=shop&cleared=${data?.length ?? 0}`);
}

export type ItemActionResult = {
  ok: boolean;
  message?: string;
  qty?: number;
};

/**
 * Setzt die Menge eines Artikels direkt aus der Kartenansicht. Wird sowohl
 * für Vorrats- als auch für Einkaufsartikel verwendet.
 */
export async function setItemQuantityAction(
  id: string,
  qty: number,
): Promise<ItemActionResult> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return {
      ok: false,
      message: "Du hast in diesem Haushalt nur Leserechte.",
    };
  }

  const itemId = String(id ?? "").trim();
  const next = Number(qty);
  if (!itemId) return { ok: false, message: "Artikel fehlt." };
  if (!Number.isFinite(next) || next < 0) {
    return { ok: false, message: "Bitte eine Menge ab 0 eingeben." };
  }

  const rounded = Math.round(next * 100) / 100;
  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_items")
    .update({ qty: rounded })
    .eq("id", itemId)
    .eq("household_id", context.active.id)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  revalidatePath("/");
  return { ok: true, qty: rounded };
}

export async function setItemCheckedAction(
  id: string,
  checked: boolean,
): Promise<ItemActionResult> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return {
      ok: false,
      message: "Du hast in diesem Haushalt nur Leserechte.",
    };
  }

  const itemId = String(id ?? "").trim();
  if (!itemId) return { ok: false, message: "Artikel fehlt." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_items")
    .update({ checked: Boolean(checked) })
    .eq("id", itemId)
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  revalidatePath("/");
  return { ok: true };
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

type ShopItemForStock = {
  id: string;
  name: string;
  product_id: string | null;
  qty: number | null;
  expiry: string | null;
  notes: string;
  location_id: string | null;
};

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * Sucht den leeren Vorrats-Zwilling eines Einkaufsartikels – dieselbe
 * Zuordnung wie beim gelben Warenkorb: erst Produktgruppe, sonst exakter Name.
 * Bei mehreren Kandidaten gewinnt der dringendste (frühestes MHD, dann
 * ältestes Kaufdatum).
 */
async function findStockTwin(
  supabase: DbClient,
  householdId: string,
  item: ShopItemForStock,
) {
  let query = supabase
    .from("kitchen_items")
    .select("id, qty, notes, location_id")
    .eq("household_id", householdId)
    .eq("kind", "stock")
    .lte("qty", 0)
    .is("deleted_at", null);

  if (item.product_id) {
    query = query.eq("product_id", item.product_id);
  } else {
    query = query.ilike("name", escapeLike(item.name));
  }

  const { data } = await query
    .order("expiry", { ascending: true, nullsFirst: false })
    .order("purchased_at", { ascending: true })
    .limit(1);

  return data?.[0] ?? null;
}

/**
 * Lagert einen Einkaufsartikel ein. Existiert ein leerer Vorratsartikel
 * derselben Ware, wird dieser aufgefüllt (Menge addiert, Kaufdatum heute,
 * MHD vom Einkauf übernommen bzw. geleert) und der Einkaufsartikel entfernt.
 * Ohne Zwilling wird der Einkaufsartikel selbst zum Vorratsartikel.
 */
async function moveShopItemToStock(
  supabase: DbClient,
  householdId: string,
  item: ShopItemForStock,
): Promise<boolean> {
  const twin = await findStockTwin(supabase, householdId, item);

  if (!twin) {
    const { error } = await supabase
      .from("kitchen_items")
      .update({
        kind: "stock",
        checked: false,
        purchased_at: todayIso(),
      })
      .eq("id", item.id)
      .eq("household_id", householdId)
      .is("deleted_at", null);
    return !error;
  }

  const { error: updateError } = await supabase
    .from("kitchen_items")
    .update({
      qty: (twin.qty ?? 0) + (item.qty ?? 0),
      purchased_at: todayIso(),
      // Altes MHD gehört zur verbrauchten Charge – nur das neue übernehmen.
      expiry: item.expiry,
      // Vorratsnotiz gewinnt; nur wenn sie leer ist, die Einkaufsnotiz nutzen.
      notes: twin.notes.trim() ? twin.notes : item.notes,
      location_id: item.location_id ?? twin.location_id,
    })
    .eq("id", twin.id)
    .eq("household_id", householdId);

  if (updateError) return false;

  const { error: deleteError } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", item.id)
    .eq("household_id", householdId);

  return !deleteError;
}

const shopItemForStockSelect =
  "id, name, product_id, qty, expiry, notes, location_id";

/**
 * Verschiebt alle abgehakten Einkaufsartikel in den Vorrat. Einzelne Artikel
 * können weiterhin über moveToStockAction verschoben werden.
 */
export async function moveCheckedToStockAction(): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    redirect("/items?kind=shop&error=keine-berechtigung");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .select(shopItemForStockSelect)
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .eq("checked", true)
    .is("deleted_at", null);

  if (error) {
    redirect(`/items?kind=shop&error=${encodeURIComponent(error.message)}`);
  }

  let moved = 0;
  for (const item of data ?? []) {
    if (await moveShopItemToStock(supabase, context.active.id, item)) {
      moved += 1;
    }
  }

  revalidatePath("/", "layout");
  redirect(`/items?kind=shop&moved=${moved}`);
}

export async function moveToStockAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) redirect("/items?kind=shop&error=keine-berechtigung");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("kitchen_items")
    .select(shopItemForStockSelect)
    .eq("id", id)
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .is("deleted_at", null)
    .maybeSingle();

  if (item) {
    await moveShopItemToStock(supabase, context.active.id, item);
  }

  revalidatePath("/", "layout");
}

export async function addToShoppingListAction(formData: FormData): Promise<void> {
  const context = await getActiveHousehold();
  if (!context) redirect("/onboarding");
  if (!context.active.canWrite) {
    redirect("/items?kind=stock&error=keine-berechtigung");
  }

  const sourceId = String(formData.get("id") ?? "");
  if (!sourceId) return;

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("kitchen_items")
    .select("name, product_id, barcode, category_id, unit_id, location_id, qty, notes")
    .eq("id", sourceId)
    .eq("household_id", context.active.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!source) return;

  // Duplikate vermeiden: bei verknüpften Artikeln zählt die Produktgruppe,
  // sonst der Name. So bleibt der Eintrag auch nach Gruppen-Umbenennungen stimmt.
  let existingQuery = supabase
    .from("kitchen_items")
    .select("id")
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .is("deleted_at", null);
  if (source.product_id) {
    existingQuery = existingQuery.eq("product_id", source.product_id);
  } else {
    existingQuery = existingQuery.ilike("name", escapeLike(source.name));
  }
  const { data: existing } = await existingQuery.maybeSingle();

  if (!existing) {
    await supabase.from("kitchen_items").insert({
      household_id: context.active.id,
      kind: "shop",
      product_id: source.product_id,
      barcode: source.barcode,
      name: source.name,
      category_id: source.category_id,
      unit_id: source.unit_id,
      location_id: source.location_id,
      qty: source.qty && source.qty > 0 ? source.qty : 1,
      notes: source.notes,
      checked: false,
    });
  }

  revalidatePath("/items");
}

/**
 * Löschen ohne Redirect: Die Oberfläche blendet den Artikel sofort aus und
 * gleicht danach im Hintergrund ab. Der Formular-Weg (deleteItemAction)
 * bleibt für den Betrieb ohne JavaScript erhalten.
 */
export async function deleteItemByIdAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const itemId = String(id ?? "").trim();
  if (!itemId) return { ok: false, message: "Artikel fehlt." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("household_id", context.active.id)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  return { ok: true };
}

/** Einkaufs-Eintrag ohne Redirect in den Vorrat übernehmen (optimistisch). */
export async function moveItemToStockByIdAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const itemId = String(id ?? "").trim();
  if (!itemId) return { ok: false, message: "Eintrag fehlt." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("kitchen_items")
    .select(shopItemForStockSelect)
    .eq("id", itemId)
    .eq("household_id", context.active.id)
    .eq("kind", "shop")
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) return { ok: false, message: "Eintrag wurde nicht gefunden." };

  const moved = await moveShopItemToStock(supabase, context.active.id, item);
  if (!moved) {
    return { ok: false, message: "Der Eintrag konnte nicht übernommen werden." };
  }

  revalidatePath("/items");
  return { ok: true };
}

/** Batch-Löschen ohne Redirect (optimistische Oberfläche). */
export async function deleteItemsByIdsAction(
  ids: string[],
): Promise<{ ok: boolean; message?: string; count?: number }> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };
  if (!context.active.canWrite) {
    return { ok: false, message: "Du hast in diesem Haushalt nur Leserechte." };
  }

  const unique = [
    ...new Set(
      (Array.isArray(ids) ? ids : []).filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ].slice(0, BULK_DELETE_LIMIT);

  if (unique.length === 0) return { ok: true, count: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", unique)
    .eq("household_id", context.active.id)
    .eq("kind", "stock")
    .is("deleted_at", null)
    .select("id");

  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  return { ok: true, count: data?.length ?? 0 };
}
