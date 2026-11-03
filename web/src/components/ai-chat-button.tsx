"use client";

import { Sparkles } from "lucide-react";

import { useAiChat } from "@/components/ai-chat-context";
import { cn } from "@/lib/utils";

/**
 * Öffnet das KI-Chat-Overlay. Variante "icon" für die mobile Kopfzeile,
 * "nav" für die Desktop-Sidebar.
 */
export function AiChatButton({ variant }: { variant: "icon" | "nav" }) {
  const { status, toggle } = useAiChat();
  const active = status !== "closed";
  const label =
    status === "open" ? "KI-Chat ausblenden" : "KI-Chat öffnen";

  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active
            ? "bg-[var(--accent-700)] text-white shadow-sm"
            : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        )}
      >
        <Sparkles className="size-5 shrink-0" />
        <span>KI-Küche</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2",
        active
          ? "bg-[var(--accent-700)] text-white shadow-sm"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
      )}
    >
      <Sparkles className="size-5" />
    </button>
  );
}
