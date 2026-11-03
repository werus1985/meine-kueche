import { legacySettingsRedirect } from "../legacy-redirect";

export default async function QuickFiltersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await legacySettingsRedirect("schnellfilter", searchParams);
}
