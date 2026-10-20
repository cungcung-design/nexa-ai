import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import { ChevronIcon, ShieldIcon } from "@/components/approvals/icons";

type ApprovalAssignment = {
  id: string;
  organization_id: string;
  policy_id: string | null;
  user_id: string;
  user_email: string;
  is_primary: boolean;
  created_at: string;
};

export default async function ApprovalsAssignmentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  const assignments = org
    ? await backendGet<ApprovalAssignment[] | null>(
        `/api/v1/organizations/${org.id}/approvals/assignments`
      )
    : null;

  if (!org) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Assignments</h1>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

  const list = assignments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/organizations/${organizationId}/approvals/inbox`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2"
          >
            <ChevronIcon className="size-3" /> Back to inbox
          </Link>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Human-in-the-Loop
          </p>
          <h1 className="mt-2 text-3xl font-bold">Reviewer Assignments</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Route approval requests to authorized reviewers.
          </p>
        </div>
      </div>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <ShieldIcon className="mx-auto mb-3 size-7 text-zinc-400" />
            <p className="text-sm">No reviewer assignments configured.</p>
            <p className="text-xs text-zinc-400 mt-1">
              Assign reviewers to approval policies so requests are routed correctly.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {list.map((a) => (
              <div key={a.id} className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldIcon className="size-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {a.user_email}
                    </p>
                    <p className="text-xs text-zinc-500">
                      User {a.user_id}
                      {a.policy_id ? ` · Policy ${a.policy_id}` : ""}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.is_primary
                    ? "bg-blue-500/10 text-blue-700 border border-blue-200"
                    : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                }`}>
                  {a.is_primary ? "Primary" : "Reviewer"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {!canManage && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Assignment management is restricted to organization Owners and Admins.
        </div>
      )}
    </div>
  );
}
