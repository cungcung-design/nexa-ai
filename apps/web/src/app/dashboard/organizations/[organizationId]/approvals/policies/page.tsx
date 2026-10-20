import { backendGet, asArray } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import { ShieldIcon, ChevronIcon } from "@/components/approvals/icons";

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

export default async function ApprovalsPoliciesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  const policies = org
    ? asArray<ApprovalPolicy>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/approvals/policies`
        )
      )
    : [];

  if (!org) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">Approval Policies</h1>
        <p className="text-sm text-zinc-400">Choose an organization to continue.</p>
      </div>
    );
  }

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
          <h1 className="mt-2 text-3xl font-bold">Approval Policies</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Control when AI actions require human review.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/dashboard/organizations/${organizationId}/approvals/policies/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <PlusIcon className="size-4" /> New Policy
          </Link>
        )}
      </div>

      <section className="border border-zinc-200 rounded-xl overflow-hidden">
        {policies.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <ShieldIcon className="mx-auto mb-3 size-7 text-zinc-400" />
            <p className="text-sm">No approval policies configured yet.</p>
            <p className="text-xs text-zinc-400 mt-1">
              Policies define which AI actions require human review.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {policies.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/organizations/${organizationId}/approvals/policies/${p.id}`}
                className="block px-4 py-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50/50 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                    <p className="text-xs text-zinc-500">
                      {p.action_pattern} · {p.risk_level}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.is_enabled
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200"
                        : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                    }`}>
                      {p.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatDate(p.updated_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!canManage && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Policy management is restricted to organization Owners and Admins.
        </div>
      )}
    </div>
  );
}

function PlusIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
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
