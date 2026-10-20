import { backendPost } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import Link from "next/link";
import {
  ChevronIcon,
  ShieldIcon,
  RejectIcon,
} from "@/components/approvals/icons";

type ApprovalPolicyCreate = {
  name: string;
  description?: string | null;
  action_pattern: string;
  risk_level: "low" | "medium" | "high" | "critical";
  is_enabled: boolean;
};

export default async function NewPolicyPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: orgId } = await params;
  const org = await authorizedOrganization(orgId);
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  if (!org || !canManage) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Human-in-the-Loop
        </p>
        <h1 className="mt-2 text-3xl font-bold">New Policy</h1>
        <p className="text-sm text-zinc-400">Not authorized to create policies.</p>
      </div>
    );
  }

  async function handleSubmit(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const actionPattern = formData.get("action_pattern") as string;
    const riskLevel = formData.get("risk_level") as ApprovalPolicyCreate["risk_level"];

    try {
      const response = await backendPost<unknown>(
        `/api/v1/organizations/${orgId}/approvals/policies`,
        {
          name,
          description: description || null,
          action_pattern: actionPattern,
          risk_level: riskLevel,
          is_enabled: true,
        } as ApprovalPolicyCreate
      );
      if (!response) throw new Error("Failed to create policy");
    } catch {
      // error handled by backend response
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 mb-2">
        <Link
          href={`/dashboard/organizations/${orgId}/approvals/policies`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ChevronIcon className="size-3" /> Back to policies
        </Link>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
        Human-in-the-Loop
      </p>
      <h1 className="mt-2 text-3xl font-bold">New Approval Policy</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Define which AI actions require human review.
      </p>

      <form action={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Policy name
              </label>
              <input
                name="name"
                defaultValue=""
                placeholder="e.g. Order Cancellation Approval"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Description
              </label>
              <textarea
                name="description"
                defaultValue=""
                rows={3}
                placeholder="Describe when this policy applies..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Action pattern
              </label>
              <input
                name="action_pattern"
                defaultValue=""
                placeholder="e.g. cancel_order"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-mono focus:border-blue-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Pattern matched against requested actions.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Risk level
              </label>
              <select
                name="risk_level"
                defaultValue="medium"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ShieldIcon className="size-4" /> Create Policy
          </button>
          <Link
            href={`/dashboard/organizations/${orgId}/approvals/policies`}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            <RejectIcon className="size-4" /> Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
