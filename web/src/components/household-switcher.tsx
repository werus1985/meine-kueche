"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronsUpDown, Home } from "lucide-react";

import { switchHousehold } from "@/actions/household";
import type { HouseholdSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShoppingMode } from "@/lib/use-shopping-mode";

export function HouseholdSwitcher({
  households,
  active,
}: {
  households: HouseholdSummary[];
  active: HouseholdSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const shopping = useShoppingMode();

  if (households.length <= 1) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700",
          shopping && "accent-shop",
        )}
      >
        <Home className="size-4 shrink-0 text-[var(--accent-700)]" />
        <span className="min-w-0 truncate">{active.name}</span>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-xl border border-stone-200 bg-white pl-3 pr-2 text-sm font-medium text-stone-700",
        pending && "opacity-60",
        shopping && "accent-shop",
      )}
    >
      <Home className="size-4 shrink-0 text-[var(--accent-700)]" />
      <select
        aria-label="Haushalt auswählen"
        value={active.id}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await switchHousehold(next);
            router.refresh();
          });
        }}
        className="min-w-0 max-w-44 cursor-pointer appearance-none truncate bg-transparent py-2 pr-6 outline-none"
      >
        {households.map((household) => (
          <option key={household.id} value={household.id}>
            {household.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 size-4 text-stone-400" />
    </label>
  );
}
