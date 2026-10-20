import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import { ChevronIcon } from "@/components/approvals/icons";

type ApprovalPolicy = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  action_pattern: string;
  risk_level: "low" | "medium" | "high" | "critical";
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export default async function ApprovalPolicyPage({
  params,
}: {
  params: Promise<{ organizationId: string; policyId: string }>;
}) {
  const { organizationId, policyId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  const policy = org
    ? await backendGet<ApprovalPolicy | null>(
        `/api/v1/organizations/${org.id}/approvals/policies/${policyId}`
      )
    : null;

  if (!org) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Policy Details</h1>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/dashboard/organizations/${organizationId}/approvals/policies`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2"
          >
            <ChevronIcon className="size-3" /> Back to policies
          </Link>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Human-in-the-Loop
          </p>
          <h1 className="mt-2 text-3xl font-bold">Policy Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/organizations/${organizationId}/approvals/policies`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2"
          >
            <ChevronIcon className="size-3" /> Back to policies
          </Link>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Human-in-the-Loop
          </p>
          <h1 className="mt-2 text-3xl font-bold">{policy.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {policy.description ?? "No description."}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            policy.is_enabled
              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200"
              : "bg-zinc-100 text-zinc-600 border border-zinc-200"
          }`}>
            {policy.is_enabled ? "Enabled" : "Disabled"}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            policy.risk_level === "critical"
              ? "bg-rose-500/10 text-rose-700"
              : policy.risk_level === "high"
              ? "bg-amber-500/10 text-amber-700"
              : "bg-blue-500/10 text-blue-700"
          }`}>
            {policy.risk_level}
          </span>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Action pattern" value={policy.action_pattern} />
        <StatBox label="Risk level" value={policy.risk_level} />
        <StatBox label="Created" value={formatDate(policy.created_at)} />
        <StatBox label="Updated" value={formatDate(policy.updated_at)} />
      </section>

      {!canManage && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Policy editing is restricted to organization Owners and Admins.
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
