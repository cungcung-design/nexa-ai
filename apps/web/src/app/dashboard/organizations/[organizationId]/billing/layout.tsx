import { BillingNav } from "@/components/billing/shared";

export default async function BillingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <BillingNav organizationId={organizationId} />
      </div>
      {children}
    </div>
  );
}
