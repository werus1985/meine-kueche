"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type AiChatStatus = "closed" | "minimized" | "open";

type AiChatContextValue = {
  status: AiChatStatus;
  open: () => void;
  minimize: () => void;
  close: () => void;
  toggle: () => void;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiChatStatus>("closed");

  const value: AiChatContextValue = {
    status,
    open: () => setStatus("open"),
    minimize: () => setStatus("minimized"),
    close: () => setStatus("closed"),
    toggle: () => setStatus((current) => (current === "open" ? "minimized" : "open")),
  };

  return (
    <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
  );
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("useAiChat muss innerhalb des AiChatProvider verwendet werden.");
  }
  return context;
}
