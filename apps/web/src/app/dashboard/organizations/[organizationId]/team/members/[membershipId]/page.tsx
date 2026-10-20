import Link from "next/link";
import { MemberRowActions } from "@/components/team/member-row-actions";
import {
  Avatar,
  RoleBadge,
  StatusBadge,
  TeamCard,
  TeamEmptyState,
  TeamErrorState,
  TeamFooterNote,
  TeamInfoNote,
  formatTimestamp,
} from "@/components/team/shared";
import {
  BotIcon,
  BookIcon,
  ChevronIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "@/components/team/icons";
import { AUTH_ME_PATH, backendGet, type User } from "@/lib/api";
import { teamMember, teamRoles } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; membershipId: string }>;
}) {
  const { organizationId, membershipId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <TeamCard>
        <TeamEmptyState
          title="No workspace selected"
          description="Choose an organization to view its members."
        />
      </TeamCard>
    );
  }

  const [detail, roles, user] = await Promise.all([
    teamMember(org.id, membershipId),
    teamRoles(org.id),
    backendGet<User>(AUTH_ME_PATH),
  ]);

  if (!detail) {
    return (
      <TeamCard>
        <TeamErrorState message="This member could not be found." />
      </TeamCard>
    );
  }

  const { member, effective_permissions, resources, activity } = detail;
  const base = `/dashboard/organizations/${organizationId}/team`;
  const isSelf =
    !!user?.email &&
    member.email.toLowerCase() === user.email.toLowerCase();

  const resourceGroups = [
    {
      title: "Agents",
      icon: <BotIcon size={15} />,
      count: resources.agents_count,
      note: "Agents the member can open in this workspace.",
      items: resources.agents,
    },
    {
      title: "Knowledge Bases",
      icon: <BookIcon size={15} />,
      count: resources.knowledge_bases_count,
      note: "Knowledge bases the member can open in this workspace.",
      items: resources.knowledge_bases,
    },
    {
      title: "Approval Requests",
      icon: <ShieldCheckIcon size={15} />,
      count: resources.approvals_count,
      note: "Approval requests the member raised or decided.",
      items: resources.approvals,
    },
  ];

  return (
    <div className="space-y-4">
      <Link
        href={`${base}/members`}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6366f1] hover:underline"
      >
        <ChevronIcon size={13} className="rotate-180" />
        Back to members
      </Link>

      <TeamCard wide>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar email={member.email} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-[17px] font-semibold text-[#171717]">
                {member.email}
              </h2>
              {isSelf ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f1f5ff] text-[#6366ff]">
                  You
                </span>
              ) : null}
            </div>
            <p className="m-[3px_0_0] text-[12px] text-[#777]">
              Joined {formatTimestamp(member.created_at)}
            </p>
          </div>
          <RoleBadge label={member.role_label} />
          <StatusBadge status={member.status} />
          <MemberRowActions
            organizationId={organizationId}
            membershipId={member.id}
            email={member.email}
            role={member.role}
            status={member.status}
            roles={roles.map((role) => ({ role: role.role, label: role.label }))}
            canManage={detail.can_manage}
            isSelf={isSelf}
          />
        </div>
      </TeamCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <TeamCard>
          <h3 className="m-0 text-[15px] font-semibold text-[#171717]">
            Effective Permissions
          </h3>
          <p className="m-[2px_0_0] text-[12px] text-[#777]">
            Resolved from the workspace role and the membership status.
          </p>

          <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
            {effective_permissions.map((permission) => (
              <li
                key={permission.permission}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-medium text-[#171717]">
                    {permission.label}
                  </p>
                  <p className="m-0 text-[11px] text-[#929292]">
                    {permission.source === "workspace_role"
                      ? "Workspace role"
                      : permission.source}
                    {permission.restriction ? ` - ${permission.restriction}` : ""}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                    permission.granted
                      ? "bg-[#e0f2df] text-[#28a745]"
                      : "bg-[#f2f2f2] text-[#929292]"
                  }`}
                >
                  {permission.granted ? "Granted" : "Not granted"}
                </span>
              </li>
            ))}
          </ul>

          <TeamFooterNote>
            <TeamInfoNote>{detail.groups_note}</TeamInfoNote>
            <TeamInfoNote>{detail.direct_access_note}</TeamInfoNote>
          </TeamFooterNote>
        </TeamCard>

        <div className="space-y-4">
          {resourceGroups.map((group) => (
            <TeamCard key={group.title}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 flex items-center gap-2 text-[15px] font-semibold text-[#171717]">
                  <span className="text-[#6366f1]">{group.icon}</span>
                  {group.title}
                </h3>
                <span className="text-[12px] text-[#777]">{group.count}</span>
              </div>
              <p className="m-[2px_0_0] text-[12px] text-[#777]">{group.note}</p>

              {group.items.length === 0 ? (
                <TeamEmptyState
                  title="Nothing to show"
                  description="This member has no access to workspace resources yet."
                />
              ) : (
                <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
                  {group.items.slice(0, 6).map((resource) => (
                    <li key={resource.id} className="py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[13px] text-[#171717]">
                          {resource.name}
                        </span>
                        {resource.can_open && resource.href ? (
                          <Link
                            href={resource.href}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6366f1] hover:underline"
                          >
                            Open
                            <ExternalLinkIcon size={12} />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-[#929292]">
                            {resource.type}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {group.title === "Approval Requests" ? (
                <TeamFooterNote>
                  <span className="inline-flex items-center gap-1.5">
                    <WorkflowIcon size={13} />
                    {resources.workflows_note}
                  </span>
                </TeamFooterNote>
              ) : null}
            </TeamCard>
          ))}
        </div>
      </div>

      <TeamCard wide>
        <h3 className="m-0 text-[15px] font-semibold text-[#171717]">
          Recent Activity
        </h3>
        {activity.length === 0 ? (
          <TeamEmptyState
            title="No activity yet"
            description="Actions taken by or for this member will appear here."
          />
        ) : (
          <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
            {activity.slice(0, 10).map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-1 w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13px] font-medium text-[#171717]">
                    {entry.title}
                  </p>
                  {entry.summary ? (
                    <p className="m-0 text-[12px] text-[#777]">{entry.summary}</p>
                  ) : null}
                </div>
                <span className="text-[11px] text-[#929292] shrink-0">
                  {formatTimestamp(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TeamCard>
    </div>
  );
}
