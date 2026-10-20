import { AccountSecurityForm } from "@/components/settings/account-security";
import { PersonalSettingsShell } from "@/components/settings/personal-shell";

export default function AccountSecurityPage() {
  return (
    <PersonalSettingsShell
      title="Account Security"
      description="Protect the account you sign in with."
    >
      <AccountSecurityForm />
    </PersonalSettingsShell>
  );
}
