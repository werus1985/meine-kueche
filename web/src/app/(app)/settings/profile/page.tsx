import { LogOut, Mail, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { AiKeyForm } from "@/components/ai-key-form";
import { ProfileForm } from "@/components/profile-form";
import { Badge, buttonSecondary, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getProfile, requireHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/utils";

export default async function ProfilePage() {
  const user = await requireUser();
  const { active } = await requireHousehold();
  const profile = await getProfile(user.id);
  const supabase = await createClient();
  const [personalKey, householdKey] = await Promise.all([
    supabase
      .from("user_ai_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("households")
      .select("gemini_api_key")
      .eq("id", active.id)
      .maybeSingle(),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Profil" />
      <div className="grid gap-3 lg:grid-cols-2">
        <ProfileForm
          displayName={profile?.display_name ?? ""}
          email={user.email ?? ""}
        />
        <AiKeyForm
          hasPersonalKey={Boolean(personalKey.data?.user_id)}
          hasHouseholdKey={Boolean(householdKey.data?.gemini_api_key)}
        />
        <Card>
          <CardHeader title="Konto" />
          <div className="space-y-3 px-5 py-4 text-sm text-stone-700">
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-stone-400" /> {user.email}
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-stone-400" />
              <span>{active.name}</span>
              <Badge tone={active.role === "owner" ? "green" : "neutral"}>
                {roleLabel(active.role)}
              </Badge>
            </p>
            <form action={signOutAction}>
              <button type="submit" className={buttonSecondary}>
                <LogOut className="size-4" /> Abmelden
              </button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
