"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Kleine, nicht blockierende Rückmeldungen statt Seiten-Banner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback<ShowToast>((message, tone = "success") => {
    const id = nextId.current++;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex flex-col items-center gap-2 px-4 sm:bottom-8"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-lg",
              item.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900",
            )}
          >
            {item.tone === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast muss innerhalb des ToastProvider verwendet werden.");
  }
  return context;
}
