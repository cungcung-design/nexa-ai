import Link from "next/link";
import {
  Avatar,
  MetricCard,
  RoleBadge,
  StatusBadge,
  TeamCard,
  TeamEmptyState,
  TeamFooterNote,
  formatTimestamp,
} from "@/components/team/shared";
import {
  MailIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from "@/components/team/icons";
import {
  teamInvitations,
  teamMembers,
  teamMetrics,
  teamRoles,
} from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <TeamCard>
        <TeamEmptyState
          title="No workspace selected"
          description="Choose an organization to manage its team."
        />
      </TeamCard>
    );
  }

  const [metrics, memberList, invitations, roles] = await Promise.all([
    teamMetrics(org.id),
    teamMembers(org.id),
    teamInvitations(org.id),
    teamRoles(org.id),
  ]);

  const members = memberList?.items ?? [];
  const pending = invitations.filter(
    (invitation) => invitation.status === "PENDING"
  );
  const base = `/dashboard/organizations/${organizationId}/team`;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Total Members"
          value={metrics?.total_members ?? members.length}
          icon={<UsersIcon size={16} />}
          iconClassName="text-[#6366f1]"
          iconBackground="bg-[#f1f5ff]"
          href={`${base}/members`}
        />
        <MetricCard
          label="Active Members"
          value={metrics?.active_members ?? 0}
          icon={<UserCheckIcon size={16} />}
          iconClassName="text-[#28a745]"
          iconBackground="bg-[#e0f2df]"
          href={`${base}/members`}
        />
        <MetricCard
          label="Pending Invitations"
          value={metrics?.pending_invitations ?? pending.length}
          icon={<MailIcon size={16} />}
          iconClassName="text-[#d77d00]"
          iconBackground="bg-[#fffbeb]"
          href={`${base}/invitations`}
        />
        <MetricCard
          label="Roles"
          value={metrics?.roles ?? roles.length}
          icon={<ShieldCheckIcon size={16} />}
          iconClassName="text-[#2563eb]"
          iconBackground="bg-[#dbeafe]"
          href={`${base}/roles`}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <TeamCard wide>
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
              Members
            </h2>
            <Link
              href={`${base}/members`}
              className="text-[12px] font-medium text-[#6366f1] hover:underline"
            >
              View all
            </Link>
          </div>

          {members.length === 0 ? (
            <TeamEmptyState
              title="No members yet"
              description="Invite a teammate to start collaborating in this workspace."
            />
          ) : (
            <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
              {members.slice(0, 6).map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-2.5">
                  <Avatar email={member.email} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`${base}/members/${member.id}`}
                      className="block truncate text-[13px] font-medium text-[#171717] hover:underline"
                    >
                      {member.email}
                    </Link>
                    <p className="m-0 text-[11px] text-[#929292]">
                      Joined {formatTimestamp(member.created_at)}
                    </p>
                  </div>
                  <RoleBadge label={member.role_label} />
                  <StatusBadge status={member.status} />
                </li>
              ))}
            </ul>
          )}

          <TeamFooterNote>
            Roles are stored on the workspace membership. Changing a role takes
            effect on the next request the member makes.
          </TeamFooterNote>
        </TeamCard>

        <div className="space-y-4">
          <TeamCard>
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
                Pending Invitations
              </h2>
              <Link
                href={`${base}/invitations`}
                className="text-[12px] font-medium text-[#6366f1] hover:underline"
              >
                View all
              </Link>
            </div>

            {pending.length === 0 ? (
              <TeamEmptyState
                title="No pending invitations"
                description="Invited teammates appear here until they accept."
              />
            ) : (
              <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
                {pending.slice(0, 5).map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[13px] font-medium text-[#171717]">
                        {invitation.email}
                      </p>
                      <p className="m-0 text-[11px] text-[#929292]">
                        Expires {formatTimestamp(invitation.expires_at)}
                      </p>
                    </div>
                    <RoleBadge label={invitation.role_label} />
                  </li>
                ))}
              </ul>
            )}
          </TeamCard>

          <TeamCard>
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
                Roles
              </h2>
              <Link
                href={`${base}/roles`}
                className="text-[12px] font-medium text-[#6366f1] hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="m-0 mt-3 p-0 list-none divide-y divide-[#f0f0f0]">
              {roles.map((role) => (
                <li
                  key={role.role}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-[13px] font-medium text-[#171717]">
                    {role.label}
                  </span>
                  <span className="text-[12px] text-[#777]">
                    {role.member_count}{" "}
                    {role.member_count === 1 ? "member" : "members"}
                  </span>
                </li>
              ))}
            </ul>
            <TeamFooterNote>
              The workspace role is the only implemented permission source. Group
              and direct resource grants are not supported yet.
            </TeamFooterNote>
          </TeamCard>
        </div>
      </div>
    </div>
  );
}
