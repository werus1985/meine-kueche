"use client";

import { ChevronDown, Sparkles, X } from "lucide-react";

import { AiChat } from "@/components/ai-chat";
import { useAiChat } from "@/components/ai-chat-context";
import { cn } from "@/lib/utils";

export type AiChatConfig = {
  configured: boolean;
  stockCount: number;
  expiringCount: number;
  canWrite: boolean;
};

/**
 * Chat-Overlay der KI-Küche. Ausblenden (Pfeil) hält die Unterhaltung am
 * Leben – wieder geöffnet wird über den KI-Button in Kopfzeile/Sidebar.
 * Beenden (✕) schließt sie endgültig und leert den Verlauf.
 */
export function AiChatOverlay({ ai }: { ai: AiChatConfig }) {
  const { status, minimize, close } = useAiChat();

  if (status === "closed") return null;

  return (
    <div
      className={cn("fixed inset-0 z-50", status === "minimized" && "hidden")}
    >
      <div
        className="absolute inset-0 bg-stone-950/30 sm:hidden"
        onClick={minimize}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="false"
        aria-label="KI-Küche Chat"
        className="absolute inset-x-0 bottom-0 flex h-[86dvh] max-h-[86dvh] flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-stone-50 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(720px,82dvh)] sm:w-[440px] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-700)] text-white">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">
                KI-Küche
              </p>
              <p className="truncate text-[11px] text-stone-500">
                Dein Küchenhelfer
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={minimize}
              aria-label="Chat ausblenden"
              title="Chat ausblenden"
              className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              <ChevronDown className="size-5" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Chat beenden"
              title="Chat beenden"
              className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-red-50 hover:text-red-700"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <AiChat
            configured={ai.configured}
            stockCount={ai.stockCount}
            expiringCount={ai.expiringCount}
            canWrite={ai.canWrite}
          />
        </div>
      </section>
    </div>
  );
}
