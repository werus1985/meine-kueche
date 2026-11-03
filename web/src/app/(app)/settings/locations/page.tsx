import { legacySettingsRedirect } from "../legacy-redirect";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await legacySettingsRedirect("lagerorte", searchParams);
}
