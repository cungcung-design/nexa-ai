import type { Metadata } from "next";

import { SecurityPage } from "@/components/public/security-page";

export const metadata: Metadata = {
  title: "Security — NEXORA",
};

export default function Page() {
  return <SecurityPage />;
}
