import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AiChatOverlayLazy } from "@/components/ai-chat-overlay-lazy";
import { AiChatProvider } from "@/components/ai-chat-context";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ToastProvider } from "@/components/toast";
import { getActiveHousehold, getProfile } from "@/lib/data";
import { getRequestIdentity } from "@/lib/request-identity";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/utils";

// KI-Anfragen (Gemini) brauchen auf Vercel mehr als die Standard-Laufzeit;
// 60 s ist das Maximum im Hobby-Plan.
export const maxDuration = 60;

export default async function AppLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const user = await getRequestIdentity();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Haushalte, Profil und persönlicher KI-Key hängen nicht voneinander ab –
  // gemeinsam in einer Welle abfragen.
  const [context, profile, personalKey] = await Promise.all([
    getActiveHousehold(),
    getProfile(user.id),
    supabase
      .from("user_ai_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!context) redirect("/onboarding");

  // Diese beiden brauchen die aktive Haushalts-ID.
  const [householdKey, stockResult] = await Promise.all([
    supabase
      .from("households")
      .select("gemini_api_key")
      .eq("id", context.active.id)
      .maybeSingle(),
    supabase
      .from("kitchen_items")
      .select("expiry")
      .eq("household_id", context.active.id)
      .eq("kind", "stock")
      .is("deleted_at", null),
  ]);

  const stockRows = stockResult.data ?? [];
  const aiConfig = {
    configured: Boolean(personalKey.data?.user_id) ||
      Boolean(householdKey.data?.gemini_api_key),
    stockCount: stockRows.length,
    expiringCount: stockRows.filter((item) => {
      const days = daysUntil(item.expiry);
      return days !== null && days >= 0 && days <= 7;
    }).length,
    canWrite: context.active.canWrite,
  };

  return (
    <AiChatProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppShell
            context={context}
            user={{
              email: user.email ?? "",
              displayName: profile?.display_name ?? null,
            }}
          >
            {children}
            {modal}
          </AppShell>
          <AiChatOverlayLazy ai={aiConfig} />
        </ConfirmProvider>
      </ToastProvider>
    </AiChatProvider>
  );
}
