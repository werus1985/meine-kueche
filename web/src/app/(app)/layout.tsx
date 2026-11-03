import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getActiveHousehold, getProfile } from "@/lib/data";

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

  return (
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
  );
}
