import { Sparkles } from "lucide-react";

import { AiChat } from "@/components/ai-chat";
import { PageHeader } from "@/components/ui";
import { requireHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/utils";

export default async function AiPage() {
  const { active } = await requireHousehold();
  const supabase = await createClient();
  const today = todayIso();
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const soon = inSevenDays.toISOString().slice(0, 10);

  const [stock, expiring] = await Promise.all([
    supabase
      .from("kitchen_items")
      .select("*", { count: "exact", head: true })
      .eq("household_id", active.id)
      .eq("kind", "stock")
      .is("deleted_at", null),
    supabase
      .from("kitchen_items")
      .select("*", { count: "exact", head: true })
      .eq("household_id", active.id)
      .eq("kind", "stock")
      .not("expiry", "is", null)
      .gte("expiry", today)
      .lte("expiry", soon)
      .is("deleted_at", null),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="KI-Küche"
        title="Was kochen wir?"
        description="Der KI-Küchenhelfer kennt deinen Vorrat, Mengen und Mindesthaltbarkeitsdaten. Frag nach Rezepten, Einkaufstipps oder einer Einkaufsliste."
        action={
          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <Sparkles className="size-4" /> Gemini
          </span>
        }
      />

      <AiChat
        configured={Boolean(process.env.GEMINI_API_KEY)}
        stockCount={stock.count ?? 0}
        expiringCount={expiring.count ?? 0}
        canWrite={active.canWrite}
      />
    </div>
  );
}
