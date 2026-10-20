import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";
import "@/app/auth.css";

export const metadata: Metadata = {
  title: "Terms of Service — Nexa AI",
  description: "The terms that apply to the use of the Nexa AI platform.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms describe the agreement between you and Nexa AI when you use
        the platform, the workspace, and the services that are included in your
        plan.
      </p>
      <p>
        You keep the ownership of the data you upload to your workspace. You
        grant Nexa AI the permission to process that data only to deliver the
        services you asked for.
      </p>
      <p>
        The service is provided as is. Write to your workspace administrator
        for the details of the agreement that covers your organization.
      </p>
    </LegalPage>
  );
}
