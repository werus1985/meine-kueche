import { HouseholdForm } from "@/components/household-form";
import { HouseholdManager } from "@/components/household-manager";
import { MembersManager } from "@/components/members-manager";
import { Alert, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { requireHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type SearchParams = {
  saved?: string;
  revoked?: string;
  removed?: string;
  error?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  "keine-berechtigung": "Nur Eigentümer dürfen Mitglieder und Einladungen verwalten.",
  "owner-rolle": "Nur Eigentümer dürfen weitere Eigentümer ernennen.",
};

export default async function HouseholdSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, user, context] = await Promise.all([
    searchParams,
    requireUser(),
    requireHousehold(),
  ]);
  const { active, households } = context;
  const supabase = await createClient();

  const householdResult = await supabase
    .from("households")
    .select("external_lookup_enabled")
    .eq("id", active.id)
    .maybeSingle();

  const membersResult = await supabase.rpc("get_household_members", {
    p_household_id: active.id,
  });
  const invitesResult = active.canManageMembers
    ? await supabase
        .from("household_invites")
        .select("id, email, role, expires_at")
        .eq("household_id", active.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const members = (membersResult.data ?? []).map((member) => ({
    userId: member.user_id,
    displayName: (member.display_name as string | null) ?? null,
    email: (member.email as string | null) ?? null,
    role: member.role as RoleKey,
    joinedAtLabel: formatDateTime(member.joined_at),
  }));
  const invites = (invitesResult.data ?? []).map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role as RoleKey,
    expiresAtLabel: formatDateTime(invite.expires_at),
  }));

  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Haushalt & Mitglieder" />

      {params.saved ? <Alert tone="success">Rolle wurde gespeichert.</Alert> : null}
      {params.revoked ? <Alert tone="success">Einladung wurde zurückgezogen.</Alert> : null}
      {params.removed ? <Alert tone="success">Mitglied wurde entfernt.</Alert> : null}
      {params.error ? (
        <div className="mb-3">
          <Alert tone="error">{ERROR_MESSAGES[params.error] ?? params.error}</Alert>
        </div>
      ) : null}
      {membersResult.error ? (
        <div className="mb-3">
          <Alert tone="error">Mitglieder konnten nicht geladen werden.</Alert>
        </div>
      ) : null}
      {invitesResult.error ? (
        <div className="mb-3">
          <Alert tone="error">Einladungen konnten nicht geladen werden.</Alert>
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <HouseholdManager households={households} activeId={active.id} />
        <HouseholdForm
          name={active.name}
          externalLookupEnabled={householdResult.data?.external_lookup_enabled ?? true}
          canManage={active.canManageHousehold}
        />
      </div>

      <section id="mitglieder" className="scroll-mt-28">
        <MembersManager
          key={`${params.saved ?? ""}${params.revoked ?? ""}${params.removed ?? ""}${params.error ?? ""}`}
          members={members}
          invites={invites}
          currentUserId={user.id}
          canManageMembers={active.canManageMembers}
          canManageHousehold={active.canManageHousehold}
        />
      </section>
    </div>
  );
}
