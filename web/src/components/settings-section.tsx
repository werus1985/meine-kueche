import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Aufklappbarer Bereich der Einstellungen. Kopf und Inhalt bilden eine
 * gemeinsame Karte, damit klar erkennbar ist, wo ein Bereich beginnt und endet.
 */
export function SettingsSection({
  id,
  title,
  open = false,
  children,
}: {
  id: string;
  title: string;
  /** Serverseitig aus `?section=` – öffnet den Bereich beim Laden. */
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group scroll-mt-32 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition open:border-[var(--accent-300)] open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-500)] group-open:rounded-b-none group-open:border-b group-open:border-[var(--accent-100)] group-open:bg-[var(--accent-50)] group-open:text-[var(--accent-900)] group-open:hover:bg-[var(--accent-50)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">{title}</span>
        <ChevronDown className="size-4 shrink-0 text-stone-400 transition group-open:rotate-180 group-open:text-[var(--accent-700)]" />
      </summary>
      <div className="bg-stone-50/70 px-3 py-3 sm:px-4 sm:py-4">{children}</div>
    </details>
  );
}
