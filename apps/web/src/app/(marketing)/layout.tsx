import type { ReactNode } from "react";

import { PublicFrame } from "@/components/public/public-frame";

import "../public-home.css";

/**
 * Shared chrome for the public marketing routes.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}
