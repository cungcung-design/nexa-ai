import { PersonalSettingsShell } from "@/components/settings/personal-shell";
import { ProfileForm } from "@/components/settings/profile-form";
import { backendGet } from "@/lib/api";
import type { PersonalSettings } from "@/lib/api/settings";

export default async function ProfilePage() {
  const initial = await backendGet<PersonalSettings>("/api/v1/settings/me", {
    revalidate: 0,
  });

  return (
    <PersonalSettingsShell
      title="My Profile"
      description="The details that identify you across the workspaces you belong to."
    >
      <ProfileForm initial={initial} />
    </PersonalSettingsShell>
  );
}
