"use client";

import { Alert } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "error"}>
      {state.message}
      {state.inviteUrl ? (
        <span className="mt-2 block break-all rounded-lg bg-white/70 px-2 py-1 font-mono text-xs">
          {state.inviteUrl}
        </span>
      ) : null}
    </Alert>
  );
}
