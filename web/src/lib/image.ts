/**
 * Client-Helfer zum Verkleinern von Fotos vor dem Upload.
 *
 * Vercel begrenzt Request-Bodies auf 4,5 MB – deshalb wird im Browser auf
 * maximal 4 MB heruntergerechnet. Schlägt das fehl, bleibt die Originaldatei
 * erhalten und der Server lehnt sie mit einer Meldung ab.
 */

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

function asJpegName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export async function compressImageFile(
  file: File,
  maxBytes: number = PHOTO_MAX_BYTES,
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.size <= maxBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  try {
    if (!context) return file;
    for (const maxDimension of [2048, 1600, 1200]) {
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size <= maxBytes) {
          return new File([blob], asJpegName(file.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }
    }
    return file;
  } finally {
    bitmap.close?.();
  }
}

/** Ersetzt die Auswahl eines Datei-Feldes durch die komprimierte Datei. */
export function replaceFileInput(input: HTMLInputElement, file: File) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Browser ohne DataTransfer-Unterstützung: Original bleibt ausgewählt.
  }
}
