import Link from "next/link";
import { cookies } from "next/headers";
import { InvitationAccept } from "@/components/team/invitation-accept";
import {
  RoleBadge,
  StatusBadge,
  TeamCard,
  TeamEmptyState,
  TeamFooterNote,
  formatTimestamp,
} from "@/components/team/shared";
import { invitationPreview } from "@/lib/api";

// The preview is read per request, so the route renders at request time
// instead of being prerendered.
export const instant = false;

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await invitationPreview(token);
  const signedIn = !!(await cookies()).get("nexa_access")?.value;

  if (!preview) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7f7f8] p-6">
        <TeamCard>
          <TeamEmptyState
            title="Invitation not found"
            description="This invitation link is unknown. Ask the workspace owner to send a new one."
          />
          <div className="pt-3 border-t border-[#dedede]">
            <Link
              href="/dashboard"
              className="text-[12px] font-medium text-[#6366f1] hover:underline"
            >
              Back to the dashboard
            </Link>
          </div>
        </TeamCard>
      </main>
    );
  }

  const pending = preview.status === "PENDING";
  const expired = preview.status === "EXPIRED";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f7f8] p-6">
      <div className="w-full max-w-[520px]">
        <TeamCard>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#818cf8]">
            Workspace invitation
          </p>
          <h1 className="mt-1.5 mb-0 text-[22px] font-bold tracking-tight text-[#171717]">
            {preview.organization_name}
          </h1>
          <p className="mt-1 mb-0 text-[13px] leading-[19px] text-[#777]">
            {preview.email} has been invited to join this workspace as{" "}
            {preview.role_label}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <RoleBadge label={preview.role_label} />
            <StatusBadge status={expired ? "EXPIRED" : preview.status} />
            <span className="text-[12px] text-[#929292]">
              {pending
                ? `Expires ${formatTimestamp(preview.expires_at)}`
                : `Updated ${formatTimestamp(preview.expires_at)}`}
            </span>
          </div>

          {preview.message ? (
            <p className="mt-4 mb-0 p-3 border border-[#dedede] rounded-[11px] bg-[#fafafa] text-[13px] italic leading-[19px] text-[#444]">
              &ldquo;{preview.message}&rdquo;
            </p>
          ) : null}

          {preview.permission_labels.length > 0 ? (
            <div className="mt-4">
              <p className="m-0 text-[12px] font-semibold text-[#171717]">
                {preview.role_label} permissions
              </p>
              <ul className="m-[8px_0_0] p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                {preview.permission_labels.map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-1.5 text-[12px] text-[#444]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5">
            {pending && !expired ? (
              signedIn ? (
                <InvitationAccept
                  token={token}
                  organizationId={preview.organization_id}
                />
              ) : (
                <div>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invitations/${token}`)}`}
                    className="inline-flex items-center justify-center w-full h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium hover:bg-black transition-colors"
                  >
                    Sign in to accept
                  </Link>
                  <p className="mt-2 mb-0 text-[11px] leading-[16px] text-[#929292]">
                    The invitation was issued to {preview.email}. Sign in with
                    that address to accept it.
                  </p>
                  <Link
                    href={`/register?next=${encodeURIComponent(`/invitations/${token}`)}`}
                    className="mt-2 inline-block text-[12px] font-medium text-[#6366f1] hover:underline"
                  >
                    Create an account with {preview.email}
                  </Link>
                </div>
              )
            ) : (
              <TeamEmptyState
                title={
                  preview.status === "ACCEPTED"
                    ? "This invitation was already accepted"
                    : preview.status === "REVOKED"
                      ? "This invitation was revoked"
                      : "This invitation expired"
                }
                description={
                  preview.status === "ACCEPTED"
                    ? "Ask the workspace owner if you need a different role."
                    : "Ask the workspace owner to send a new invitation."
                }
              />
            )}
          </div>

          <TeamFooterNote>
            Accepting creates your membership with the invited role. The
            workspace role is the only permission source in this release.
          </TeamFooterNote>
        </TeamCard>
      </div>
    </main>
  );
}
