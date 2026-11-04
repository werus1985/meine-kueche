"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { AiChatConfig } from "@/components/ai-chat-overlay";

// Der Chat wird erst nach dem ersten Paint geladen – das hält das Start-Bundle
// klein, ohne dass Funktionen fehlen.
const AiChatOverlay = dynamic(
  () => import("@/components/ai-chat-overlay").then((mod) => mod.AiChatOverlay),
  { ssr: false },
);

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function AiChatOverlayLazy({ ai }: { ai: AiChatConfig }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), {
        timeout: 2000,
      });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(handle);
  }, []);

  if (!ready) return null;
  return <AiChatOverlay ai={ai} />;
}
