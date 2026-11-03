import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpenText,
  LogOut,
  Package,
  Settings,
} from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { AiChatButton } from "@/components/ai-chat-button";
import { BrandMark } from "@/components/brand-mark";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { IconNavLink } from "@/components/icon-nav-link";
import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui";
import type { HouseholdContext } from "@/lib/data";
import type { HouseholdSummary } from "@/lib/types";
import { initials, roleLabel } from "@/lib/utils";

const navigation = [
  { href: "/items", label: "Vorrat & Einkauf", icon: Package },
  { href: "/recipes", label: "Rezepte", icon: BookOpenText },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

function NavItems() {
  return (
    <>
      {navigation.slice(0, 2).map((entry) => (
        <NavLink
          key={entry.href}
          href={entry.href}
          icon={<entry.icon className="size-5" />}
          exact={entry.href === "/items"}
        >
          {entry.label}
        </NavLink>
      ))}
      <AiChatButton variant="nav" />
      {navigation.slice(2).map((entry) => (
        <NavLink
          key={entry.href}
          href={entry.href}
          icon={<entry.icon className="size-5" />}
          exact={entry.href === "/items"}
        >
          {entry.label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell({
  context,
  user,
  children,
}: {
  context: HouseholdContext;
  user: { email: string; displayName: string | null };
  children: ReactNode;
}) {
  const active: HouseholdSummary = context.active;
  const label = user.displayName || user.email;

  return (
    <div className="min-h-screen bg-stone-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
        <Link href="/items" className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark className="size-10 rounded-2xl shadow-sm" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-stone-900">
              Meine Küche
            </p>
            <p className="text-xs text-stone-500">Vorrat &amp; Einkauf</p>
          </div>
        </Link>

        <div className="px-3">
          <HouseholdSwitcher households={context.households} active={active} />
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          <NavItems />
        </nav>

        <div className="border-t border-stone-100 p-3">
          <Link
            href="/settings/profile"
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-stone-100"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-100)] text-xs font-semibold text-[var(--accent-800)]">
              {initials(label)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-stone-800">
                {label}
              </span>
              <span className="block text-xs text-stone-500">
                {roleLabel(active.role)}
              </span>
            </span>
          </Link>
          <form action={signOutAction} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              <LogOut className="size-5" />
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Mobile Kopfzeile: eine Zeile, feste Höhe + Safe-Area. Die Suche
            klebt passgenau darunter (siehe inventory-workspace), daher kann
            nichts mehr überlappen. */}
        <header
          className="sticky top-0 z-40 bg-white/90 shadow-[0_1px_0_0_rgba(28,25,23,0.08)] backdrop-blur lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-14 items-center gap-2 px-4">
            <Link
              href="/items"
              aria-label="Vorrat & Einkauf"
              className="flex shrink-0 items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2"
            >
              <BrandMark className="size-9 rounded-xl" />
              <span className="hidden text-sm font-semibold text-stone-900 sm:inline">
                Meine Küche
              </span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <HouseholdSwitcher households={context.households} active={active} />
              <IconNavLink href="/recipes" label="Rezepte">
                <BookOpenText className="size-5" />
              </IconNavLink>
              <AiChatButton variant="icon" />
              <IconNavLink href="/settings" label="Einstellungen">
                <Settings className="size-5" />
              </IconNavLink>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {active.role === "viewer" ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <Badge tone="amber">Nur Lesen</Badge>
              <span>
                Du kannst in „{active.name}“ alles ansehen, aber nichts ändern.
              </span>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
