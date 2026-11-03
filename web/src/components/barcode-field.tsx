"use client";

import type { IScannerControls } from "@zxing/browser";
import { CameraOff, Loader2, ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, buttonSecondary, inputClass, Label } from "@/components/ui";

export function BarcodeField({
  defaultValue = "",
  onValueChange,
}: {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [code, setCode] = useState(defaultValue);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

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
          const detected = result.getText().replace(/\s+/g, "").trim();
          controlsRef.current?.stop();
          controlsRef.current = null;
          setScanning(false);
          if (detected) {
            setCode(detected);
            onValueChange?.(detected);
          }
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
    <div>
      <Label htmlFor="barcode" hint="8–14 Ziffern">
        Barcode
      </Label>
      <div className="flex gap-2">
        <input
          id="barcode"
          name="barcode"
          inputMode="numeric"
          pattern="[0-9]{8,14}"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            onValueChange?.(event.target.value);
          }}
          placeholder="4001234567890"
          className={inputClass}
        />
        <button
          type="button"
          onClick={scanning ? stop : start}
          disabled={starting}
          className={`${buttonSecondary} shrink-0 px-3`}
          title={scanning ? "Kamera stoppen" : "Barcode mit Kamera scannen"}
        >
          {starting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : scanning ? (
            <CameraOff className="size-4" />
          ) : (
            <ScanBarcode className="size-4" />
          )}
          <span className="hidden sm:inline">
            {scanning ? "Stopp" : "Scannen"}
          </span>
        </button>
      </div>

      <div
        className={
          scanning
            ? "mt-2 overflow-hidden rounded-xl border border-stone-200 bg-stone-900"
            : "hidden"
        }
      >
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          muted
          playsInline
        />
      </div>

      {scanning ? (
        <p className="mt-1 text-xs text-emerald-700">
          Barcode in den Rahmen halten – er wird automatisch übernommen.
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-400">
          Scannen oder manuell eingeben. Das Mindesthaltbarkeitsdatum trägst du
          unten separat ein.
        </p>
      )}

      {error ? (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
