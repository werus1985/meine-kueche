import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/auth";

export type RequestIdentity = {
  id: string;
  email: string | null;
};

/**
 * Identität des angemeldeten Nutzers. Der Proxy hat die Session bereits über
 * Supabase Auth verifiziert und reicht sie als Header weiter – dadurch spart
 * jeder Seitenaufbau einen zusätzlichen Auth-Roundtrip.
 */
export const getRequestIdentity = cache(
  async (): Promise<RequestIdentity | null> => {
    const headerStore = await headers();
    const id = headerStore.get("x-mk-user-id");
    if (id) {
      return { id, email: headerStore.get("x-mk-user-email") || null };
    }

    // Fallback (z. B. wenn der Proxy nicht lief): normal verifizieren.
    const user = await getCurrentUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  },
);
