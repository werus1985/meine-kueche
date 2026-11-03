"use client";

import { useState, useTransition } from "react";

import { setItemCheckedAction } from "@/actions/items";
import { cn } from "@/lib/utils";

export function ShoppingCheckbox({
  itemId,
  checked,
  canWrite,
  label,
}: {
  itemId: string;
  checked: boolean;
  canWrite: boolean;
  label: string;
}) {
  const [isChecked, setIsChecked] = useState(checked);
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={isChecked}
      disabled={!canWrite || pending}
      onChange={(event) => {
        const next = event.target.checked;
        setIsChecked(next);
        startTransition(async () => {
          const result = await setItemCheckedAction(itemId, next);
          if (!result.ok) setIsChecked(!next);
        });
      }}
      aria-label={label}
      title={isChecked ? "Als offen markieren" : "Als gekauft abhaken"}
      className={cn(
        "mt-0.5 size-5 shrink-0 cursor-pointer rounded border-stone-300 text-[var(--accent-700)] accent-[var(--accent-700)] focus:ring-2 focus:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        pending && "opacity-60",
      )}
    />
  );
}
