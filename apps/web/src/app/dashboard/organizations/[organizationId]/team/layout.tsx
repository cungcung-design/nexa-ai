import { TeamNav } from "@/components/team/team-nav";
import { authorizedOrganization } from "@/lib/workspace";

export const instant = false;

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#818cf8]">
            Workspace / Team
          </p>
          <h1 className="mt-1.5 mb-0 text-[26px] font-bold tracking-tight text-[#171717]">
            Team
          </h1>
          <p className="mt-1 mb-0 text-[13px] leading-[19px] text-[#777]">
            {org
              ? `Manage members, roles and invitations for ${org.name}.`
              : "Manage workspace members, roles and invitations."}
          </p>
        </div>
        <TeamNav organizationId={organizationId} />
      </header>
      {children}
    </div>
  );
}
