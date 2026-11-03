import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AiChatOverlay } from "@/components/ai-chat-overlay";
import { AiChatProvider } from "@/components/ai-chat-context";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getActiveHousehold, getProfile } from "@/lib/data";
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
  const user = await requireUser();
  const context = await getActiveHousehold();

  if (!context) redirect("/onboarding");

  const profile = await getProfile(user.id);

  const supabase = await createClient();
  const [personalKey, householdKey, stockResult] = await Promise.all([
    supabase
      .from("user_ai_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
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
      <AiChatOverlay ai={aiConfig} />
    </AiChatProvider>
  );
}
