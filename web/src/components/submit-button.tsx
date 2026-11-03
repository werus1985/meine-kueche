"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel = "Wird gespeichert …",
  className,
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
