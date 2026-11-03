import { legacySettingsRedirect } from "../legacy-redirect";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await legacySettingsRedirect("einheiten", searchParams);
}
