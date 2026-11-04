"use client";

import type { ReactNode } from "react";

import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * Submit-Button mit In-App-Bestätigung. Der eigentliche Submit wird erst nach
 * Zustimmung ausgelöst (funktioniert auch für Server-Action-Formulare).
 */
export function ConfirmSubmitButton({
  message,
  children,
  className,
  title,
  ariaLabel,
  confirmLabel = "Löschen",
  confirmDescription,
  tone = "danger",
}: {
  message: string;
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
  confirmLabel?: string;
  confirmDescription?: string;
  tone?: "danger" | "default";
}) {
  const confirm = useConfirm();

  return (
    <button
      type="submit"
      className={cn(className)}
      title={title}
      aria-label={ariaLabel}
      onClick={async (event) => {
        event.preventDefault();
        const form = event.currentTarget.form;
        const accepted = await confirm({
          title: message,
          description: confirmDescription,
          confirmLabel,
          tone,
        });
        if (accepted) form?.requestSubmit();
      }}
    >
      {children}
    </button>
  );
}
