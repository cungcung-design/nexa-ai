import { SettingsDashboard } from "@/components/settings/settings-dashboard";
import { AUTH_ME_PATH, backendGet, type User } from "@/lib/api";
import { resolveActiveOrganization } from "@/lib/workspace";

export default async function SettingsPage() {
  const [organization, user] = await Promise.all([
    resolveActiveOrganization(),
    backendGet<User>(AUTH_ME_PATH),
  ]);

  return (
    <SettingsDashboard
      organizationId={organization?.id ?? null}
      user={{ name: user?.full_name ?? null, email: user?.email ?? null }}
    />
  );
}
