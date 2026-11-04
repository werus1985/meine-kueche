import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isAllowedExternalPhotoUrl } from "@/lib/barcode-lookup";
import { createClient } from "@/lib/supabase/server";

// Vercel begrenzt Request-Bodies auf 4,5 MB; der Client verkleinert vorher.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadPhoto(
  householdId: string,
  ownerId: string,
  file: File,
) {
  if (file.size === 0) return { path: null as string | null };
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Das Foto darf höchstens 5 MB groß sein." };
  }
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return { error: "Bitte ein Foto im Format JPG, PNG oder WebP wählen." };
  }

  const supabase = await createClient();
  const path = `${householdId}/${ownerId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from("product-photos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };
  return { path };
}

export async function removePhoto(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from("product-photos").remove([path]);
}

/**
 * Lädt ein Produktfoto aus der externen Datenbank herunter und legt es im
 * eigenen Speicher ab (Best-Effort: Fehler/Timeout = kein Foto).
 */
export async function importExternalPhoto(
  householdId: string,
  ownerId: string,
  url: string,
  client?: SupabaseClient,
): Promise<string | null> {
  if (!isAllowedExternalPhotoUrl(url)) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MeineKueche/0.1 (private Haushalts-App)" },
      // OFF liefert Bilder teils erst nach 10–25 s; läuft im Hintergrund.
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.has(type)) return null;
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_PHOTO_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return null;

    const supabase = client ?? (await createClient());
    const path = `${householdId}/${ownerId}/${crypto.randomUUID()}.${extensionFor(type)}`;
    const { error } = await supabase.storage
      .from("product-photos")
      .upload(path, bytes, { contentType: type, upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}
