import Link from "next/link";
import type { ReactNode } from "react";
import { ChefHat, Package, ScanBarcode, Users } from "lucide-react";

const highlights = [
  {
    icon: Package,
    title: "Vorräte im Blick",
    description: "Mengen, Lagerorte und Haltbarkeit an einem Ort.",
  },
  {
    icon: Users,
    title: "Gemeinsam verwalten",
    description: "Mehrere Personen pro Haushalt mit eigenen Rechten.",
  },
  {
    icon: ScanBarcode,
    title: "Barcode scannen",
    description: "Produkte blitzschnell finden oder neu anlegen.",
  },
];

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between bg-emerald-800 p-10 text-emerald-50 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_55%)]" />
        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15">
            <ChefHat className="size-6" />
          </span>
          <span>
            <span className="block text-base font-semibold tracking-tight">
              Meine Küche
            </span>
            <span className="block text-xs text-emerald-200">
              Gemeinsam vorplanen
            </span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Küche organisieren, ohne den Überblick zu verlieren.
          </h1>
          <p className="mt-3 text-sm text-emerald-100/90">
            Vorräte, Einkaufsliste und Haushaltsverwaltung – abgestimmt auf alle,
            die mit einkaufen und kochen.
          </p>
          <ul className="mt-8 space-y-4">
            {highlights.map((highlight) => (
              <li key={highlight.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <highlight.icon className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {highlight.title}
                  </span>
                  <span className="block text-xs text-emerald-200">
                    {highlight.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-300/80">
          Prototyp · Daten werden in Supabase gespeichert
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2.5 lg:hidden"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <ChefHat className="size-5" />
            </span>
            <span className="text-sm font-semibold text-stone-900">
              Meine Küche
            </span>
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{description}</p>

          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-sm text-stone-500">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
