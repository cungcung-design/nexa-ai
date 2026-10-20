import { PersonalSettingsShell } from "@/components/settings/personal-shell";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { backendGet } from "@/lib/api";
import type { PersonalSettings } from "@/lib/api/settings";

export default async function PreferencesPage() {
  const initial = await backendGet<PersonalSettings>("/api/v1/settings/me", {
    revalidate: 0,
  });

  return (
    <PersonalSettingsShell
      title="Preferences"
      description="These preferences belong to your account and are not shared with a workspace."
    >
      <PreferencesForm initial={initial} />
    </PersonalSettingsShell>
  );
}
