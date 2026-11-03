import { redirect } from "next/navigation";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  redirect(`/settings/household${query.size ? `?${query.toString()}` : ""}#mitglieder`);
}
