import { legacySettingsRedirect } from "../legacy-redirect";

export default async function WarningRulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await legacySettingsRedirect("warnregeln", searchParams);
}
