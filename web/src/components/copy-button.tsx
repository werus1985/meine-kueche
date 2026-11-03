"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Link kopieren",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(buttonSecondary, className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Link kopieren", value);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Kopiert" : label}
    </button>
  );
}
