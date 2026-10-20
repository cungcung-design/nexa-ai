import { InviteForm } from "@/components/team/invite-form";
import { InvitationRowActions } from "@/components/team/invitation-row-actions";
import {
  RoleBadge,
  StatusBadge,
  TeamCard,
  TeamEmptyState,
  TeamFooterNote,
  formatTimestamp,
} from "@/components/team/shared";
import { teamInvitations, teamRoles } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function TeamInvitationsPage({
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
          description="Choose an organization to manage its invitations."
        />
      </TeamCard>
    );
  }

  const canManage = org.role === "OWNER" || org.role === "ADMIN";
  const [invitations, roles] = await Promise.all([
    teamInvitations(org.id),
    teamRoles(org.id),
  ]);

  return (
    <div className="space-y-4">
      {canManage ? (
        <TeamCard wide>
          <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
            Invite a teammate
          </h2>
          <p className="m-[2px_0_0] text-[12px] text-[#777]">
            Invitations stay pending for seven days and can only be accepted by
            the invited address.
          </p>
          <div className="mt-4">
            <InviteForm organizationId={organizationId} roles={roles} />
          </div>
        </TeamCard>
      ) : null}

      <TeamCard wide>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
              Invitations
            </h2>
            <p className="m-[2px_0_0] text-[12px] text-[#777]">
              Send, resend or revoke every invitation for this workspace.
            </p>
          </div>
          <span className="text-[12px] text-[#777]">
            {invitations.length}{" "}
            {invitations.length === 1 ? "invitation" : "invitations"}
          </span>
        </div>

        {invitations.length === 0 ? (
          <TeamEmptyState
            title="No invitations yet"
            description={
              canManage
                ? "Invite a teammate to grant access to this workspace."
                : "Only owners and admins can see or manage invitations."
            }
          />
        ) : (
          <ul className="m-0 mt-4 p-0 list-none divide-y divide-[#f0f0f0]">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13px] font-medium text-[#171717]">
                    {invitation.email}
                  </p>
                  <p className="m-0 text-[11px] text-[#929292]">
                    {invitation.invited_by_email
                      ? `Invited by ${invitation.invited_by_email}`
                      : "Invitation sent"}
                    {" - "}
                    {invitation.status === "PENDING"
                      ? `Expires ${formatTimestamp(invitation.expires_at)}`
                      : `Updated ${formatTimestamp(
                          invitation.accepted_at ??
                            invitation.revoked_at ??
                            invitation.created_at
                        )}`}
                  </p>
                  {invitation.message ? (
                    <p className="m-[3px_0_0] text-[12px] italic text-[#777]">
                      &ldquo;{invitation.message}&rdquo;
                    </p>
                  ) : null}
                </div>
                <RoleBadge label={invitation.role_label} />
                <StatusBadge status={invitation.status} />
                {canManage ? (
                  <InvitationRowActions
                    organizationId={organizationId}
                    invitationId={invitation.id}
                    status={invitation.status}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <TeamFooterNote>
          Resending issues a new link and restarts the seven day window.
          Revoking cancels the invitation permanently.
        </TeamFooterNote>
      </TeamCard>
    </div>
  );
}
