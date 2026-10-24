import type { Metadata } from "next";

import { SolutionsPage } from "@/components/public/solutions-page";

export const metadata: Metadata = {
  title: "Solutions — NEXORA",
};

export default function Page() {
  return <SolutionsPage />;
}
