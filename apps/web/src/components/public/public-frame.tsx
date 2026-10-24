import type { ReactNode } from "react";

import { CallToAction } from "@/components/public/call-to-action";
import { PublicHeader } from "@/components/public/public-header";

/**
 * The public page chrome: navigation, page content, and the closing footer.
 */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="nx-homepage nx-public-page">
      <div className="nx-container">
        <PublicHeader />
        <main>{children}</main>
        <CallToAction />
      </div>
    </div>
  );
}
