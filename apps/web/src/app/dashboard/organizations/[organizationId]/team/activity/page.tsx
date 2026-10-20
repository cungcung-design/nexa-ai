import {
  TeamCard,
  TeamEmptyState,
  TeamFooterNote,
  formatTimestamp,
} from "@/components/team/shared";
import { teamActivity } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

const OUTCOME_TONE: Record<string, string> = {
  success: "bg-[#e0f2df] text-[#28a745]",
  failure: "bg-[#fce5da] text-[#e85b0b]",
  denied: "bg-[#fce5da] text-[#b42318]",
};

export default async function TeamActivityPage({
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
          description="Choose an organization to review its activity."
        />
      </TeamCard>
    );
  }

  const entries = await teamActivity(org.id);

  return (
    <TeamCard wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
            Workspace Activity
          </h2>
          <p className="m-[2px_0_0] text-[12px] text-[#777]">
            Member, permission and workspace events recorded for this
            organization.
          </p>
        </div>
        <span className="text-[12px] text-[#777]">
          {entries.length} {entries.length === 1 ? "event" : "events"}
        </span>
      </div>

      {entries.length === 0 ? (
        <TeamEmptyState
          title="No activity yet"
          description="Invitations, role changes and removals are recorded here."
        />
      ) : (
        <ul className="m-0 mt-4 p-0 list-none divide-y divide-[#f0f0f0]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 text-[13px] font-medium text-[#171717]">
                    {entry.title}
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f2f2f2] text-[#666]">
                    {entry.category}
                  </span>
                  {entry.outcome ? (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        OUTCOME_TONE[entry.outcome] ?? "bg-[#f2f2f2] text-[#666]"
                      }`}
                    >
                      {entry.outcome}
                    </span>
                  ) : null}
                </div>
                {entry.summary ? (
                  <p className="m-[3px_0_0] text-[12px] leading-[17px] text-[#777]">
                    {entry.summary}
                  </p>
                ) : null}
                <p className="m-[3px_0_0] text-[11px] text-[#929292]">
                  {entry.actor_email ?? "System"}
                  {entry.resource_name ? ` - ${entry.resource_name}` : ""}
                </p>
              </div>
              <span className="text-[11px] text-[#929292] shrink-0 whitespace-nowrap">
                {formatTimestamp(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <TeamFooterNote>
        Only member, permission and workspace events are listed. The full audit
        trail lives in the audit log screens.
      </TeamFooterNote>
    </TeamCard>
  );
}
