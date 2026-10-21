import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";
import "@/app/auth.css";

export const metadata: Metadata = {
  title: "Privacy Policy — NEXORA",
  description: "How NEXORA handles the data of your workspace.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        NEXORA stores the account details, the workspace content, and the
        activity records that are needed to run the services you use.
      </p>
      <p>
        Passwords are never stored in clear text and the session tokens are
        held in protected cookies. The audit trail of your workspace records
        the security relevant events of your organization.
      </p>
      <p>
        Write to your workspace administrator to request a copy of the data that
        belongs to your account.
      </p>
    </LegalPage>
  );
}
