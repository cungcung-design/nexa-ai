import { backendGet, type ApprovalDetail } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import { DecisionButtons } from "@/components/approvals/decision-buttons";
import {
  ShieldIcon,
  ChevronIcon,
  ClockIcon,
  CheckIcon,
  RejectIcon,
} from "@/components/approvals/icons";

export default async function ApprovalReviewPage({
  params,
}: {
  params: Promise<{ organizationId: string; approvalId: string }>;
}) {
  const { organizationId, approvalId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canReview = org?.role === "OWNER" || org?.role === "ADMIN";

  const approval = org
    ? await backendGet<ApprovalDetail | null>(
        `/api/v1/organizations/${org.id}/approvals/${approvalId}`
      )
    : null;

  if (!org) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Review</h1>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

  if (!approval) {
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
          <h1 className="mt-2 text-3xl font-bold">Approval Not Found</h1>
        </div>
      </div>
    );
  }

  const decided = approval.status !== "PENDING";
  const isApproved = approval.status === "APPROVED";
  const isRejected = approval.status === "REJECTED";

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
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              approval.status === "PENDING"
                ? "bg-amber-500/10 text-amber-700 border border-amber-200"
                : approval.status === "APPROVED"
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200"
                : approval.status === "REJECTED"
                ? "bg-rose-500/10 text-rose-700 border border-rose-200"
                : "bg-zinc-100 text-zinc-600 border border-zinc-200"
            }`}>
              {approval.status}
            </span>
            {decided && (
              <span className="text-xs text-zinc-500">· decided</span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">
            {approval.action}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Request {approval.id}</p>
        </div>
        {decided ? (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            isApproved
              ? "bg-emerald-100 text-emerald-700"
              : isRejected
              ? "bg-rose-100 text-rose-700"
              : "bg-zinc-100 text-zinc-600"
          }`}>
            {isApproved ? (
              <>
                <CheckIcon className="size-3 text-emerald-600 mr-1" /> Approved
              </>
            ) : isRejected ? (
              <>
                <RejectIcon className="size-3 text-rose-600 mr-1" /> Rejected
              </>
            ) : (
              "Expired"
            )}
          </span>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Target agent" value="AI Agent" />
        <StatBox label="Action" value={approval.action} />
        <StatBox label="Thread" value={approval.thread_id} />
        <StatBox label="Created" value={formatDate(approval.created_at)} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
          <ShieldIcon className="size-4 text-blue-600" />
          Action requiring approval
        </h3>
        <p className="text-sm text-zinc-700 mb-2">
          An AI agent has requested permission to perform this action. Review the
          parameters and expected impact before deciding.
        </p>
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
            <p className="text-xs font-semibold text-zinc-500 uppercase">Parameters</p>
          </div>
          <div className="divide-y divide-zinc-100">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-zinc-500">Action type</span>
              <span className="text-sm font-mono text-zinc-900">{approval.action}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-zinc-500">Requested by</span>
              <span className="text-sm text-zinc-900">
                {approval.requested_by ?? "System"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
          <ClockIcon className="size-4 text-blue-600" />
          Execution status
        </h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
            <ClockIcon className="size-5 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {decided ? (isApproved ? "Approved — awaiting execution" : isRejected ? "Rejected — blocked" : "Expired — no decision possible") : "Pending review"}
            </p>
            <p className="text-xs text-zinc-500">
              Execution status is tracked separately from the approval decision.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <ShieldIcon className="size-4 text-blue-600" />
          Reviewer decision
        </h3>
        <DecisionButtons
          orgId={organizationId}
          approvalId={approval.id}
          status={approval.status}
          onDecision={() => {}}
        />
        {decided && approval.decided_by && (
          <p className="mt-3 text-xs text-zinc-500">
            Decided by user {approval.decided_by}
            {approval.decided_at ? ` at ${formatDate(approval.decided_at)}` : ""}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <RelatedCard
          title="Related agent"
          icon={<ShieldIcon className="size-4" />}
          href={`/dashboard/organizations/${organizationId}/agents`}
          label="View agents"
        />
        <RelatedCard
          title="Audit events"
          icon={<ShieldIcon className="size-4" />}
          href={`/dashboard/organizations/${organizationId}/audit`}
          label="View audit logs"
        />
        <RelatedCard
          title="Execution trace"
          icon={<ClockIcon className="size-4" />}
          href={`/dashboard/organizations/${organizationId}/analytics`}
          label="View traces"
        />
        <RelatedCard
          title="Analytics"
          icon={<CheckIcon className="size-4" />}
          href={`/dashboard/organizations/${organizationId}/analytics`}
          label="View analytics"
        />
      </section>

      {!canReview && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          You are not authorized to approve or reject this request.
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900 truncate">{value}</p>
    </div>
  );
}

function RelatedCard({
  title,
  icon,
  href,
  label,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-zinc-200 bg-white p-4 hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
        </div>
        <ChevronIcon className="size-4 text-zinc-400 group-hover:text-blue-600" />
      </div>
      <p className="text-xs text-zinc-500">{label}</p>
    </Link>
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
