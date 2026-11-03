import { getActiveHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/**
 * Liefert Produktfotos same-origin aus. Dadurch funktionieren die Bilder auch,
 * wenn die App über HTTPS läuft, die lokale Supabase-API aber nur HTTP
 * anbietet (sonst blockiert der Browser sie als Mixed Content).
 *
 * Der Pfad beginnt immer mit der Haushalts-ID; zusätzlich prüft die
 * Storage-Policy, dass der angemeldete Nutzer Mitglied dieses Haushalts ist.
 */

function contentTypeFor(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (segments.some((segment) => segment === ".." || segment === ".")) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const path = segments.map((segment) => decodeURIComponent(segment)).join("/");

  const context = await getActiveHousehold();
  if (!context) {
    return new Response("Nicht angemeldet", { status: 401 });
  }
  if (!path.startsWith(`${context.active.id}/`)) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("product-photos")
    .download(path);

  if (error || !data) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || contentTypeFor(path),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
