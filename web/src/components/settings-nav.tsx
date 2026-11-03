"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const sections = [
  { href: "/settings", label: "Stammdaten" },
  { href: "/settings/household", label: "Haushalt & Mitglieder" },
  { href: "/settings/profile", label: "Profil" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
      {sections.map((section) => {
        const active =
          section.href === "/settings"
            ? pathname.startsWith("/settings/") &&
              !pathname.startsWith("/settings/household") &&
              !pathname.startsWith("/settings/profile")
              ? true
              : pathname === "/settings"
            : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
