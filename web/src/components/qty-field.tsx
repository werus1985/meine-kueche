"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui";
import { formatQty } from "@/lib/utils";

/**
 * Kompaktes Mengenfeld fürs Artikelformular: manuell eintippbar und per
 * −/+-Button in Schritten der gewählten Einheit verstellbar. Die Gruppe ist
 * bewusst so hoch wie die übrigen Eingabefelder.
 */
export function QtyField({
  defaultValue = 0,
  stepSize = 1,
  unitName,
}: {
  defaultValue?: number;
  stepSize?: number;
  unitName?: string | null;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const step = Number.isFinite(stepSize) && stepSize > 0 ? stepSize : 1;

  const parsed = Number(value.replace(",", ".").trim());
  const current =
    Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;

  function adjust(delta: number) {
    const next = Math.max(0, Math.round((current + delta * step) * 100) / 100);
    setValue(String(next));
  }

  return (
    <div className="min-w-0">
      <Label htmlFor="qty">Menge{unitName ? ` (${unitName})` : ""}</Label>
      <div className="inline-flex h-[42px] items-center overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={current <= 0}
          aria-label="Menge verringern"
          title={`Menge um ${formatQty(step)} verringern`}
          className="inline-flex h-full w-10 shrink-0 items-center justify-center text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <input
          id="qty"
          name="qty"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => {
            // Nummern-Tastatur hat keine Leertaste → Cursor lässt sich nicht
            // verschieben. Beim Fokus alles markieren: Tippen ersetzt.
            const input = event.currentTarget;
            input.select();
            window.requestAnimationFrame(() => {
              if (document.activeElement === input) input.select();
            });
          }}
          onBlur={() => setValue(String(current))}
          className="h-full w-16 shrink-0 border-x border-stone-200 bg-white px-1 text-center text-sm font-semibold text-stone-900 outline-none focus:bg-emerald-50"
        />
        <button
          type="button"
          onClick={() => adjust(1)}
          aria-label="Menge erhöhen"
          title={`Menge um ${formatQty(step)} erhöhen`}
          className="inline-flex h-full w-10 shrink-0 items-center justify-center text-stone-600 transition hover:bg-stone-100"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
