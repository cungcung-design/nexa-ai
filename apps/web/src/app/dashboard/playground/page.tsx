import { redirectToOrgSection } from "@/lib/org-redirect";

export default async function Page() {
  await redirectToOrgSection("playground");
}
