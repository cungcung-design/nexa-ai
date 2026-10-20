import { asArray, backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import {
  ClockIcon,
  ShieldIcon,
  ChevronIcon,
} from "@/components/approvals/icons";

type ApprovalListItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  action: string;
  thread_id: string;
  requested_by: string | null;
  created_at: string;
};

export default async function ApprovalsHistoryPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canReview = org?.role === "OWNER" || org?.role === "ADMIN";

  const approvals = org
    ? asArray<ApprovalListItem>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/approvals/history`
        )
      )
    : [];

  if (!org) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Approval History</h1>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <h1 className="mt-2 text-3xl font-bold">Approval History</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Past decisions and execution outcomes.
        </p>
      </div>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        {approvals.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <ClockIcon className="mx-auto mb-3 size-7 text-zinc-400" />
            <p className="text-sm">No decision history yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {approvals.map((a) => (
              <div key={a.id} className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldIcon className="size-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {a.action}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      Request {a.id} · {a.thread_id}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.75 rounded-full text-xs font-medium ${
                  a.status === "APPROVED"
                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200"
                    : a.status === "REJECTED"
                    ? "bg-rose-500/10 text-rose-700 border border-rose-200"
                    : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                }`}>
                  {a.status}
                </span>
                <Link
                  href={`/dashboard/organizations/${organizationId}/approvals/${a.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View details
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {!canReview && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Approval history is visible to organization Owners and Admins.
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
