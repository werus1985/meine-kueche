"use client";

import { AlertTriangle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { buttonDanger, buttonPrimary, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** In-App-Bestätigung statt `window.confirm` (Promise-basiert). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [options, finish]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-950/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => finish(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="confirm-title"
              className="flex items-start gap-2 text-base font-semibold text-stone-900"
            >
              {options.tone === "danger" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
              ) : null}
              {options.title}
            </p>
            {options.description ? (
              <p className="mt-2 text-sm text-stone-600">{options.description}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(false)}
                className={buttonSecondary}
              >
                Abbrechen
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => finish(true)}
                className={cn(
                  options.tone === "danger" ? buttonDanger : buttonPrimary,
                )}
              >
                {options.confirmLabel ?? "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm muss innerhalb des ConfirmProvider verwendet werden.");
  }
  return context;
}
