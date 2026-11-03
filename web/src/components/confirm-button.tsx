"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ConfirmSubmitButton({
  message,
  children,
  className,
  title,
  ariaLabel,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="submit"
      className={cn(className)}
      title={title}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
