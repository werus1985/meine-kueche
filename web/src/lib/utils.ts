import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "–";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(`${todayIso()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export type ExpiryTone = "expired" | "soon" | "ok" | "none";

export function expiryTone(
  expiry: string | null | undefined,
  warningDays = 7,
): ExpiryTone {
  const days = daysUntil(expiry);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= warningDays) return "soon";
  return "ok";
}

export function expiryLabel(expiry: string | null | undefined) {
  const days = daysUntil(expiry);
  if (days === null) return "Kein Datum";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "Tag" : "Tage"} abgelaufen`;
  if (days === 0) return "Läuft heute ab";
  if (days === 1) return "Läuft morgen ab";
  return `Noch ${days} Tage`;
}

export function formatQty(qty: number | null | undefined) {
  if (qty === null || qty === undefined) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(qty);
}

export function normalizeBarcode(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim();
}

export function isLikelyBarcode(value: string) {
  return /^\d{8,14}$/.test(normalizeBarcode(value));
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) return "/items";
  if (!value.startsWith("/") || value.startsWith("//")) return "/items";
  return value;
}

export function roleLabel(role: string) {
  switch (role) {
    case "owner":
      return "Eigentümer";
    case "editor":
      return "Bearbeiter";
    case "viewer":
      return "Nur Lesen";
    default:
      return role;
  }
}

export function roleDescription(role: string) {
  switch (role) {
    case "owner":
      return "Darf alles: Artikel, Einstellungen und Mitglieder verwalten.";
    case "editor":
      return "Darf Artikel und Einstellungen bearbeiten, aber keine Mitglieder verwalten.";
    case "viewer":
      return "Darf alles lesen, aber nichts ändern.";
    default:
      return "";
  }
}

export function initials(nameOrEmail: string) {
  const value = nameOrEmail.trim();
  if (!value) return "?";
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}e`,
) {
  return count === 1 ? singular : plural;
 }

/**
 * Relatives Tageslabel für Kaufdatum/MHD: „Heute“, „Vor x Tagen“, „In x Tagen“.
 * Bewusst ohne „Gestern“/„Morgen“ – gestern ist „Vor 1 Tag“.
 */
export function relativeDayLabel(value: string | null | undefined) {
  const days = daysUntil(value);
  if (days === null) return null;
  if (days === 0) return "Heute";
  if (days < 0) {
    const elapsed = Math.abs(days);
    return elapsed === 1 ? "Vor 1 Tag" : `Vor ${elapsed} Tagen`;
  }
  return days === 1 ? "In 1 Tag" : `In ${days} Tagen`;
}
