import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import { PersonalSettingsShell } from "@/components/settings/personal-shell";
import { backendGet } from "@/lib/api";
import type { PersonalSettings } from "@/lib/api/settings";

export default async function NotificationsPage() {
  const initial = await backendGet<PersonalSettings>("/api/v1/settings/me", {
    revalidate: 0,
  });

  return (
    <PersonalSettingsShell
      title="Notifications"
      description="The alerts you receive and the channels that deliver them."
    >
      <NotificationPreferencesForm initial={initial} />
    </PersonalSettingsShell>
  );
}
