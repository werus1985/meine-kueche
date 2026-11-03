"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  icon,
  children,
  exact = false,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-emerald-700 text-white shadow-sm"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
