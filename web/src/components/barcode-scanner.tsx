"use client";

import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";

export function BarcodeScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  function openItem(code: string) {
    const cleaned = code.replace(/\s+/g, "");
    if (!cleaned) return;
    router.push(`/items?barcode=${encodeURIComponent(cleaned)}`);
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
          controlsRef.current?.stop();
          controlsRef.current = null;
          setScanning(false);
          openItem(result.getText());
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

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-900">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          muted
          playsInline
        />
        {!scanning ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/90 px-6 text-center text-stone-200">
            <Camera className="size-10 text-emerald-400" />
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

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-3">
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
        className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          openItem(manual);
        }}
      >
        <div className="flex-1">
          <label
            htmlFor="manualBarcode"
            className="mb-1.5 block text-sm font-medium text-stone-700"
          >
            Barcode manuell eingeben
          </label>
          <input
            id="manualBarcode"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="z. B. 4001234567890"
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonSecondary}>
          <Search className="size-4" /> Suchen
        </button>
      </form>
    </div>
  );
}
