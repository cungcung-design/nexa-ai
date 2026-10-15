import { EmbeddedChat } from "@/components/embedded-chat";

export const instant = false;

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ deploymentId: string }>;
}) {
  const { deploymentId } = await params;
  return (
    <div style={{ height: "100vh" }}>
      <EmbeddedChat deploymentId={deploymentId} />
    </div>
  );
}
