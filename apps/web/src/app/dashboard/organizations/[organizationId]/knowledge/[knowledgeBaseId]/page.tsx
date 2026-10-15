import { redirect } from "next/navigation";

// Deep links to a knowledge base resolve to the manager with the base
// pre-selected, e.g. /knowledge/<id> -> /knowledge?kb=<id>.
export default async function KnowledgeDetailRedirect({
  params,
}: {
  params: Promise<{ organizationId: string; knowledgeBaseId: string }>;
}) {
  const { organizationId, knowledgeBaseId } = await params;
  redirect(
    `/dashboard/organizations/${organizationId}/knowledge?kb=${encodeURIComponent(knowledgeBaseId)}`
  );
}
