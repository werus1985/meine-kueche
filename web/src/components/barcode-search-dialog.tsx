"use client";

import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Loader2, ScanBarcode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";

export function BarcodeSearchDialog({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  function finish(code: string) {
    const cleaned = code.replace(/\s+/g, "").trim();
    if (!cleaned) return;
    stop();
    onDetected(cleaned);
  }

  async function start() {
    setError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Dieser Browser unterstützt keinen Kamerazugriff. Bitte den Barcode manuell eingeben.",
        );
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      if (!videoRef.current) throw new Error("Kamera ist nicht bereit.");

      setScanning(true);
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (!result) return;
          finish(result.getText());
        },
      );
    } catch (cause) {
      setScanning(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Kamera konnte nicht gestartet werden.",
      );
    } finally {
      setStarting(false);
    }
  }

  // Kamera beim Schließen sicher beenden und Hintergrund einfrieren.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode für die Suche scannen"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">
            Barcode scannen
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl border border-stone-200 bg-stone-900">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            muted
            playsInline
          />
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-900/90 px-6 text-center text-stone-200">
              <ScanBarcode className="size-8 text-emerald-400" />
              <p className="text-sm">
                Kamera starten und den Barcode in den Rahmen halten.
              </p>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-3/4 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-2">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {scanning ? (
            <button type="button" className={buttonSecondary} onClick={stop}>
              <CameraOff className="size-4" /> Kamera stoppen
            </button>
          ) : (
            <button
              type="button"
              className={buttonPrimary}
              onClick={start}
              disabled={starting}
            >
              {starting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {starting ? "Kamera startet …" : "Kamera starten"}
            </button>
          )}
        </div>

        <form
          className="mt-3 flex gap-2 border-t border-stone-100 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            finish(manual);
          }}
        >
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            aria-label="Barcode manuell eingeben"
            placeholder="Barcode manuell eingeben"
            className={inputClass}
          />
          <button type="submit" className={buttonSecondary}>
            Suchen
          </button>
        </form>
      </div>
    </div>
  );
}
