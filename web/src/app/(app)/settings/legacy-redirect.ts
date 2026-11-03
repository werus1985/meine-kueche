import { redirect } from "next/navigation";

export async function legacySettingsRedirect(
  section: string,
  searchParams: Promise<Record<string, string | undefined>>,
): Promise<never> {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  query.set("section", section);
  const search = query.toString();
  redirect(`/settings${search ? `?${search}` : ""}#${section}`);
}
