import { asArray, backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import {
  ClockIcon,
  CheckIcon,
  RejectIcon,
  ShieldIcon,
  ChevronIcon,
  FilterIcon,
} from "@/components/approvals/icons";

type ApprovalListItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  action: string;
  thread_id: string;
  requested_by: string | null;
  created_at: string;
};

type ApprovalStats = {
  pending: number;
  approved_today: number;
  rejected_today: number;
  expired: number;
};

export default async function ApprovalsInboxPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canReview = org?.role === "OWNER" || org?.role === "ADMIN";

  const stats = org
    ? await backendGet<ApprovalStats | null>(
        `/api/v1/organizations/${org.id}/approvals/stats`
      )
    : null;

  const approvals = org
    ? asArray<ApprovalListItem>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/approvals`,
          { revalidate: 0 }
        )
      )
    : [];

  if (!org) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Human-in-the-Loop
          </p>
          <h1 className="mt-2 text-3xl font-bold">Approvals</h1>
        </div>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Approvals</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Review and control sensitive AI actions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Pending Review"
          value={stats?.pending ?? pendingCount}
          icon={<ClockIcon className="text-amber-600" size={16} />}
          color="text-amber-600 bg-amber-500/10 border-amber-500/20"
        />
        <MetricCard
          label="Approved Today"
          value={stats?.approved_today ?? 0}
          icon={<CheckIcon className="text-emerald-600" size={16} />}
          color="text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
        />
        <MetricCard
          label="Rejected Today"
          value={stats?.rejected_today ?? 0}
          icon={<RejectIcon className="text-rose-600" size={16} />}
          color="text-rose-600 bg-rose-500/10 border-rose-500/20"
        />
        <MetricCard
          label="Expired"
          value={stats?.expired ?? 0}
          icon={<ShieldIcon className="text-violet-600" size={16} />}
          color="text-violet-600 bg-violet-500/10 border-violet-500/20"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="search"
            placeholder="Search requests or IDs..."
            className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
          <FilterIcon className="size-4" /> Filter
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <TabButton active={true}>All Requests</TabButton>
        <TabButton>Pending</TabButton>
        <TabButton>Assigned to Me</TabButton>
        <TabButton>High Priority</TabButton>
      </div>

      <section className="border border-zinc-200 rounded-xl">
        <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Pending Approval Queue</h2>
          <Link
            href={`/dashboard/organizations/${organizationId}/approvals/history`}
            className="text-xs text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {approvals.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <ClockIcon className="mx-auto mb-3 size-7 text-zinc-400" />
            <p className="text-sm">No pending approvals.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {approvals.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/organizations/${organizationId}/approvals/${a.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShieldIcon className="size-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {a.action}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {a.thread_id}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    a.status === "PENDING"
                      ? "bg-amber-500/10 text-amber-700 border border-amber-200"
                      : a.status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200"
                      : "bg-rose-500/10 text-rose-700 border border-rose-200"
                  }`}>
                    {a.status}
                  </span>
                  <ChevronIcon className="size-4 text-zinc-400 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!canReview && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Approval review is restricted to organization Owners and Admins.
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
        </div>
        <div className="rounded-lg p-2 bg-white/60">{icon}</div>
      </div>
    </div>
  );
}

function TabButton({ active = false, children }: { active?: boolean; children: string }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
