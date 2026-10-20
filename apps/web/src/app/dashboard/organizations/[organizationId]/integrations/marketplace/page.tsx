import { asArray, backendGet, type IntegrationProvider } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) return <p className="p-6 text-gray-500">Choose an organization.</p>;

  const providers = asArray<IntegrationProvider>(
    await backendGet<unknown>(
      `/api/v1/organizations/${org.id}/integrations/providers`
    )
  );

  if (providers.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200/80 p-12 text-center">
        <p className="text-gray-500">No integration providers available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Marketplace
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            Discover providers
          </h2>
          <p className="text-sm text-gray-500">
            Browse supported integration providers and connect your workspace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} orgId={org.id} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  orgId,
}: {
  provider: IntegrationProvider;
  orgId: string;
}) {
  return (
    <Link
      href={`/dashboard/organizations/${orgId}/integrations/connect/${provider.slug}`}
      className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200/80 bg-white hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
          <span className="text-sm">{provider.slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase())
            .join("")}</span>
        </div>
        {provider.is_active ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-gray-400" />
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
      <p className="text-xs text-gray-500">{provider.description}</p>
      <div className="mt-auto flex items-center gap-1 text-xs">
        <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500">
          {provider.category}
        </span>
        <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500">
          {provider.auth_type}
        </span>
      </div>
    </Link>
  );
}
