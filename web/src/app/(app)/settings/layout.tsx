import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings-nav";
import { requireHousehold } from "@/lib/data";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireHousehold();

  return (
    <div>
      <SettingsNav />
      {children}
    </div>
  );
}
