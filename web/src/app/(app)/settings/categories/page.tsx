import { legacySettingsRedirect } from "../legacy-redirect";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await legacySettingsRedirect("kategorien", searchParams);
}
