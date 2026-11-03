"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Kompakter 44-px-Navigationsbutton für die mobile Kopfzeile. */
export function IconNavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  // Ein erneuter Tap auf das Icon der aktuellen Seite führt zurück zu den
  // Vorräten – auf Unterseiten (z. B. /settings/...) weiterhin zur Übersicht.
  const isCurrentPage = pathname === href;
  const target = isCurrentPage ? "/items" : href;
  const targetLabel = isCurrentPage ? "Zurück zu Vorräten" : label;

  return (
    <Link
      href={target}
      aria-label={targetLabel}
      title={targetLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
        active
          ? "bg-emerald-700 text-white shadow-sm"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
      )}
    >
      {children}
    </Link>
  );
}
