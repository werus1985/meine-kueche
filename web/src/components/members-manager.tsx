"use client";

import { useActionState } from "react";
import {
  Copy,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
} from "@/actions/members";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  Card,
  CardHeader,
  inputClass,
  Label,
  selectClass,
} from "@/components/ui";
import { ROLE_OPTIONS, type RoleKey } from "@/lib/types";
import { initials, roleLabel } from "@/lib/utils";

export type MemberValue = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: RoleKey;
  joinedAtLabel: string;
};

export type InviteValue = {
  id: string;
  email: string;
  role: RoleKey;
  expiresAtLabel: string;
};

export function MembersManager({
  members,
  invites,
  currentUserId,
  canManageMembers,
  canManageHousehold,
}: {
  members: MemberValue[];
  invites: InviteValue[];
  currentUserId: string;
  canManageMembers: boolean;
  canManageHousehold: boolean;
}) {
  const [state, formAction] = useActionState(createInviteAction, null);

  return (
    <div className="space-y-4">
      {canManageMembers ? (
        <Card>
          <CardHeader
            title="Mitglied einladen"
            description="Die Person erhält einen Link, den du selbst weitergeben kannst. Der Link ist 14 Tage gültig."
          />
          <form action={formAction} className="space-y-3 px-5 py-4">
            <FormMessage state={state} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="invite-email">E-Mail-Adresse</Label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@beispiel.de"
                  className={inputClass}
                />
              </div>
              <div className="w-44">
                <Label htmlFor="invite-role">Rolle</Label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="viewer"
                  className={selectClass}
                >
                  {ROLE_OPTIONS.filter(
                    (option) =>
                      option.value !== "owner" || canManageHousehold,
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className={buttonPrimary}>
                <UserPlus className="size-4" /> Einladung erstellen
              </SubmitButton>
            </div>
            {state?.inviteUrl ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <Copy className="size-4" /> Einladungslink
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-2 font-mono text-xs text-stone-700">
                    {state.inviteUrl}
                  </code>
                  <CopyButton value={state.inviteUrl} />
                </div>
                <p className="mt-2 text-xs text-emerald-800">
                  Der Link funktioniert nur mit der eingeladenen E-Mail-Adresse.
                </p>
              </div>
            ) : null}
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Mitglieder"
          description={`${members.length} ${members.length === 1 ? "Person" : "Personen"} in diesem Haushalt.`}
        />
        <ul className="divide-y divide-stone-100">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const label = member.displayName || member.email || "Unbekannt";
            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                  {initials(label)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {label}
                    {isSelf ? (
                      <span className="ml-2 text-xs font-normal text-stone-400">
                        (du)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {member.email ?? "E-Mail nur für Eigentümer sichtbar"}
                  </p>
                  <p className="text-xs text-stone-400">
                    Dabei seit {member.joinedAtLabel}
                  </p>
                </div>

                {canManageMembers ? (
                  <form
                    action={setMemberRoleAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="user_id" value={member.userId} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      className={`${selectClass} w-36`}
                      aria-label={`Rolle von ${label}`}
                    >
                      {ROLE_OPTIONS.filter(
                        (option) =>
                          option.value !== "owner" || canManageHousehold,
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className={buttonGhost} pendingLabel="…">
                      Speichern
                    </SubmitButton>
                  </form>
                ) : (
                  <Badge tone={member.role === "owner" ? "green" : "neutral"}>
                    <ShieldCheck className="size-3" />
                    {roleLabel(member.role)}
                  </Badge>
                )}

                {canManageMembers || isSelf ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="user_id" value={member.userId} />
                    <ConfirmSubmitButton
                      message={
                        isSelf
                          ? "Haushalt wirklich verlassen?"
                          : `${label} aus dem Haushalt entfernen?`
                      }
                      className={buttonDanger}
                    >
                      <Trash2 className="size-4" />
                      {isSelf ? "Verlassen" : "Entfernen"}
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="flex items-start gap-2 border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          <Users className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Der letzte Eigentümer kann weder entfernt noch herabgestuft werden.
          </span>
        </div>
      </Card>

      {canManageMembers ? (
        <Card>
          <CardHeader
            title="Offene Einladungen"
            description="Noch nicht angenommene Einladungen für diesen Haushalt."
          />
          {invites.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-500">
              Keine offenen Einladungen.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <Mail className="size-4 text-stone-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {invite.email}
                    </p>
                    <p className="text-xs text-stone-500">
                      {roleLabel(invite.role)} · gültig bis{" "}
                      {invite.expiresAtLabel}
                    </p>
                  </div>
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="id" value={invite.id} />
                    <ConfirmSubmitButton
                      message={`Einladung für ${invite.email} zurückziehen?`}
                      className={buttonGhost}
                    >
                      <Trash2 className="size-3.5 text-red-600" /> Zurückziehen
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
