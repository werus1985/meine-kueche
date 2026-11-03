"use client";

import { ChefHat } from "lucide-react";

import { cn } from "@/lib/utils";
import { useShoppingMode } from "@/lib/use-shopping-mode";

/**
 * Logo-Kachel in Sidebar und mobiler Kopfzeile. Im Einkauf-Modus wechselt
 * sie mit den übrigen Designelementen von Grün auf Blau.
 */
export function BrandMark({ className }: { className?: string }) {
  const shop = useShoppingMode();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-[var(--accent-700)] text-white",
        shop && "accent-shop",
        className,
      )}
    >
      <ChefHat className="size-5" />
    </span>
  );
}
