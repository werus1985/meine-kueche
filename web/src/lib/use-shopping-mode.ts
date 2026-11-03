"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * True, wenn gerade der Einkauf-Modus der Startseite aktiv ist. Steuert die
 * Akzentfarbe von Elementen außerhalb des eigentlichen Workspaces (Logo,
 * Haushalts-Auswahl).
 */
export function useShoppingMode() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return pathname === "/items" && searchParams.get("kind") === "shop";
}
