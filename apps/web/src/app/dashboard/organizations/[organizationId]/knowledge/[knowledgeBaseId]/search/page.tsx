import { redirect } from "next/navigation";
import { authorizedOrganization } from "@/lib/workspace";
import { KnowledgeSearchPlayground } from "@/components/knowledge-search-playground";

export default async function KnowledgeSearchPlaygroundPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    knowledgeBaseId: string;
  }>;
}) {
  const { organizationId, knowledgeBaseId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    redirect("/dashboard");
  }

  return (
    <KnowledgeSearchPlayground
      orgId={org.id}
      knowledgeBaseId={knowledgeBaseId}
    />
  );
}
