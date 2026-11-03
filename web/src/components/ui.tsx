import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-stone-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-stone-700"
    >
      <span>{children}</span>
      {hint ? <span className="text-xs font-normal text-stone-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-ring-soft)] disabled:cursor-not-allowed disabled:bg-stone-100";

export const selectClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-ring-soft)] disabled:cursor-not-allowed disabled:bg-stone-100";

export const textareaClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-ring-soft)] disabled:cursor-not-allowed disabled:bg-stone-100";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-700)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-800)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "purple";
  className?: string;
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 border-stone-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
  href?: string;
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {body}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          Ansehen <span aria-hidden="true">→</span>
        </span>
      </Link>
    );
  }

  return <Card className="p-4">{body}</Card>;
}
