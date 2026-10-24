import type { Metadata } from "next";

import { ContactPage } from "@/components/public/contact-page";

export const metadata: Metadata = {
  title: "Contact — NEXORA",
};

export default function Page() {
  return <ContactPage />;
}
