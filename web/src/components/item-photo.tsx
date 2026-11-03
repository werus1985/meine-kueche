"use client";

import { AlertTriangle, Camera, Loader2, Package, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";

import { uploadItemPhotoAction } from "@/actions/items";
import { cn } from "@/lib/utils";

export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="absolute right-4 top-4 rounded-xl bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
      />
    </div>
  );
}

/**
 * Kartenfoto: Platzhalter öffnet direkt die Fotoauswahl, ein vorhandenes
 * Foto öffnet die vergrößerte Ansicht. Bei Gruppen wird das Produktfoto
 * gepflegt (gilt für alle Artikel der Gruppe).
 */
export function ItemPhoto({
  itemId,
  productId,
  photoUrl,
  name,
  canWrite,
  className,
  iconClassName = "size-5",
}: {
  itemId?: string;
  productId?: string;
  photoUrl?: string | null;
  name: string;
  canWrite: boolean;
  className: string;
  iconClassName?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Erlaubt, dieselbe Datei nach einem Fehler erneut zu wählen.
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    if (productId) formData.set("productId", productId);
    if (itemId) formData.set("itemId", itemId);
    formData.set("photo", file);

    setError(null);
    startTransition(async () => {
      const result = await uploadItemPhotoAction(formData);
      if (!result?.ok) {
        setError(result?.message ?? "Foto konnte nicht gespeichert werden.");
      }
    });
  }

  const wrapper = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden bg-stone-100 text-stone-400",
    className,
  );

  if (photoUrl) {
    return (
      <>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setLightboxOpen(true);
          }}
          aria-label={`Foto von ${name} vergrößern`}
          title="Foto vergrößern"
          className={cn(wrapper, "cursor-zoom-in transition hover:opacity-90")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="size-full object-cover" loading="lazy" />
        </button>
        {lightboxOpen ? (
          <PhotoLightbox
            src={photoUrl}
            alt={name}
            onClose={() => setLightboxOpen(false)}
          />
        ) : null}
      </>
    );
  }

  if (!canWrite) {
    return (
      <div className={wrapper}>
        <Package className={iconClassName} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
        disabled={uploading}
        aria-label={error ?? `Foto für ${name} hinzufügen`}
        title={error ?? "Foto hinzufügen"}
        className={cn(
          wrapper,
          "cursor-pointer transition hover:bg-stone-200 hover:text-stone-600",
        )}
      >
        {uploading ? (
          <Loader2 className={cn(iconClassName, "animate-spin")} />
        ) : error ? (
          <AlertTriangle className={cn(iconClassName, "text-red-600")} />
        ) : (
          <Camera className={iconClassName} />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
    </>
  );
}
