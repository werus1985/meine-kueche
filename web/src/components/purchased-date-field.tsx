"use client";

import { CalendarDays, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui";
import { cn, relativeDayLabel, todayIso } from "@/lib/utils";

function toLocalIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PurchasedDateField({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue || todayIso());
  const today = todayIso();
  const label = relativeDayLabel(value) ?? "Heute";

  function shiftDate(amount: number) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setValue(toLocalIso(date));
  }

  return (
    <div>
      <Label htmlFor="purchased_at">Gekauft am</Label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          aria-label="Kaufdatum einen Tag zurück"
          title="Einen Tag zurück"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
        >
          <Minus className="size-4" />
        </button>
        <div className="relative flex h-10 min-w-0 flex-1 items-center justify-between rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm">
          <span>{label}</span>
          <CalendarDays className="size-4 text-stone-400" />
          <input
            id="purchased_at"
            name="purchased_at"
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value || today)}
            aria-label={`Kaufdatum: ${label}. Datum auswählen`}
            className={cn(
              "absolute inset-0 size-full min-w-0 cursor-pointer opacity-0",
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          aria-label="Kaufdatum einen Tag vor"
          title="Einen Tag vor"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setValue(today)}
        disabled={value === today}
        className={cn(
          "mt-1 rounded-full px-2 py-0.5 text-xs font-medium transition",
          value === today
            ? "bg-emerald-50 text-emerald-800"
            : "text-emerald-800 hover:bg-emerald-50",
        )}
      >
        Heute
      </button>
    </div>
  );
}
