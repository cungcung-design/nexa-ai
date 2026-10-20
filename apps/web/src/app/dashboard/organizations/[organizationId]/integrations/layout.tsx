import { redirect } from "next/navigation";
import Link from "next/link";
import { authorizedOrganization } from "@/lib/workspace";

type IntegrationsNavItem = {
  name: string;
  href: (organizationId: string) => string;
};

const INTEGRATIONS_NAV: IntegrationsNavItem[] = [
  {
    name: "Marketplace",
    href: (organizationId) =>
      `/dashboard/organizations/${organizationId}/integrations/marketplace`,
  },
  {
    name: "Connected Apps",
    href: (organizationId) =>
      `/dashboard/organizations/${organizationId}/integrations/connected`,
  },
  {
    name: "Webhooks",
    href: (organizationId) =>
      `/dashboard/organizations/${organizationId}/integrations/webhooks`,
  },
  {
    name: "Activity",
    href: (organizationId) =>
      `/dashboard/organizations/${organizationId}/integrations/activity`,
  },
];

export default async function IntegrationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Workspace / Integrations
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 tracking-tight">
            Integrations
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect third-party services to your organization.
          </p>
        </div>
      </div>

      <nav aria-label="Integrations sections" className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {INTEGRATIONS_NAV.map((item) => {
          const href = item.href(organizationId);
          return (
            <Link
              key={item.name}
              href={href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-gray-200/80 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <>{children}</>
    </div>
  );
}
