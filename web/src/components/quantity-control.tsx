"use client";

import { Minus, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { setItemQuantityAction } from "@/actions/items";
import { cn, formatQty } from "@/lib/utils";

function toDraft(value: number) {
  return String(value).replace(".", ",");
}

export function QuantityControl({
  itemId,
  qty,
  unitName,
  stepSize = 1,
  canWrite = true,
  compact = false,
}: {
  itemId: string;
  qty: number | null;
  unitName?: string | null;
  stepSize?: number;
  canWrite?: boolean;
  compact?: boolean;
}) {
  const initial = qty ?? 1;
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const step = Number.isFinite(stepSize) && stepSize > 0 ? stepSize : 1;

  if (!canWrite) {
    return (
      <span className={cn("font-medium text-stone-600", compact ? "text-xs" : "text-sm")}>
        {formatQty(qty ?? 1)} {unitName ?? ""}
      </span>
    );
  }

  function commit(next: number) {
    const rounded = Math.max(0, Math.round(next * 100) / 100);
    setValue(rounded);
    setDraft(toDraft(rounded));
    setError(null);

    startTransition(async () => {
      const result = await setItemQuantityAction(itemId, rounded);
      if (!result.ok) {
        setValue(initial);
        setDraft(toDraft(initial));
        setError(result.message ?? "Menge konnte nicht gespeichert werden.");
      }
    });
  }

  function adjust(delta: number) {
    if (pending) return;
    commit(value + delta * step);
  }

  function commitDraft() {
    const parsed = Number(draft.replace(",", ".").trim());
    if (!draft.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setError("Bitte eine Menge ab 0 eingeben.");
      setDraft(toDraft(value));
      return;
    }
    if (parsed === value) {
      setDraft(toDraft(value));
      setError(null);
      return;
    }
    commit(parsed);
  }

  return (
    <div>
      <div
        className={cn(
          "inline-flex items-center overflow-hidden border border-stone-300 bg-white",
          compact ? "rounded-lg" : "rounded-xl shadow-sm",
          pending && "opacity-70",
        )}
      >
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={pending || value <= 0}
          aria-label="Menge verringern"
          title={`Menge um ${formatQty(step)} verringern`}
          className={cn(
            "inline-flex items-center justify-center text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40",
            compact ? "size-9" : "px-2.5 py-2",
          )}
        >
          <Minus className="size-3.5" />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => {
            // Nummern-Tastatur hat keine Leertaste → Cursor lässt sich nicht
            // verschieben. Beim Fokus alles markieren: Tippen ersetzt,
            // Backspace leert das Feld.
            const input = event.currentTarget;
            input.select();
            window.requestAnimationFrame(() => {
              if (document.activeElement === input) input.select();
            });
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
            if (event.key === "Escape") {
              setDraft(toDraft(value));
              setError(null);
            }
          }}
          inputMode="decimal"
          aria-label="Menge"
          className={cn(
            // 16 px: iOS Safari zoomt beim Fokussieren automatisch, sobald ein
            // Eingabefeld kleiner als 16 px gesetzt ist.
            "border-x border-stone-200 bg-white px-1 text-center text-base font-semibold text-stone-900 outline-none focus:bg-[var(--accent-50)]",
            compact ? "h-9 w-12" : "w-14 py-2",
          )}
        />
        <button
          type="button"
          onClick={() => adjust(1)}
          disabled={pending}
          aria-label="Menge erhöhen"
          title={`Menge um ${formatQty(step)} erhöhen`}
          className={cn(
            "inline-flex items-center justify-center text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40",
            compact ? "size-9" : "px-2.5 py-2",
          )}
        >
          <Plus className="size-3.5" />
        </button>
        {unitName ? (
          <span className={cn("font-medium text-stone-500", compact ? "px-1.5 text-[10px]" : "pr-2.5 pl-1 text-xs")}>
            {unitName}
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
