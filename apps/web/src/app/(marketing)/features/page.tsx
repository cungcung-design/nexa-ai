import type { Metadata } from "next";

import { FeaturesPage } from "@/components/public/features-page";

export const metadata: Metadata = {
  title: "Features — NEXORA",
};

export default function Page() {
  return <FeaturesPage />;
}
