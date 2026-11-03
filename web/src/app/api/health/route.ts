import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leichter Health-Check für Monitoring. Fragt die Datenbank an, damit der
 * Supabase-Free-Tarif nicht nach Inaktivität pausiert.
 */
export async function GET() {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: "service-role-key-missing" },
      { status: 503 },
    );
  }

  const { error } = await admin
    .from("households")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
