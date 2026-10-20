import Link from "next/link";
import { MembersDirectory } from "@/components/team/members-directory";
import { TeamCard, TeamFooterNote } from "@/components/team/shared";
import { UserPlusIcon } from "@/components/team/icons";
import { AUTH_ME_PATH, backendGet, type User } from "@/lib/api";
import { teamMembers, teamRoles } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <TeamCard>
        <p className="m-0 text-[13px] text-[#777]">
          Choose an organization to manage its members.
        </p>
      </TeamCard>
    );
  }

  const [memberList, roles, user] = await Promise.all([
    teamMembers(org.id),
    teamRoles(org.id),
    backendGet<User>(AUTH_ME_PATH),
  ]);

  const canManage = org.role === "OWNER" || org.role === "ADMIN";
  const roleOptions = roles.map((role) => ({
    role: role.role,
    label: role.label,
  }));

  return (
    <TeamCard wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
            Workspace Members
          </h2>
          <p className="m-[2px_0_0] text-[12px] text-[#777]">
            Everyone with access to {org.name}.
          </p>
        </div>
        <Link
          href={`/dashboard/organizations/${organizationId}/team/invitations`}
          className="inline-flex items-center justify-center gap-1.5 h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors"
        >
          <UserPlusIcon size={15} />
          Invite member
        </Link>
      </div>

      <div className="mt-4">
        <MembersDirectory
          organizationId={organizationId}
          members={memberList?.items ?? []}
          roles={roleOptions}
          canManage={canManage}
          currentUserEmail={user?.email ?? ""}
        />
      </div>

      <TeamFooterNote>
        Only owners and admins can change a role, suspend a membership or remove
        a member. The workspace always keeps at least one active owner.
      </TeamFooterNote>
    </TeamCard>
  );
}
