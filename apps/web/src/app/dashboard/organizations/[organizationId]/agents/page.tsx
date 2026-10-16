import { asArray, backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentCreateForm } from "@/components/agent-create-form";
import { AgentsGrid } from "@/components/agents-grid";
import {
  AlertTriangle,
  Box,
  FileText,
  ShieldCheck,
} from "lucide-react";

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs relative flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      </div>
      <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  const agents = org
    ? asArray<Agent>(
        await backendGet<unknown>(
          `/api/v1/organizations/${org.id}/agents`
        )
      )
    : [];

  if (!org) {
    return <p className="p-6 text-zinc-400">Choose an organization to continue.</p>;
  }

  const total = agents.length;
  const published = agents.filter(
    (a) => !!a.published_version_id && !a.is_archived
  ).length;
  const drafts = agents.filter(
    (a) => !a.published_version_id && !a.is_archived
  ).length;
  const needsAttention = agents.filter((a) => a.is_archived).length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">
            Workspace / AI Agents
          </p>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            AI Agents
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Build, manage, and deploy your intelligent assistants.
          </p>
        </div>
        <AgentCreateForm orgId={org.id} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Total Agents"
          value={total}
          color="bg-blue-50 text-blue-600"
          icon={Box}
        />
        <StatCard
          label="Published"
          value={published}
          color="bg-emerald-50 text-emerald-600"
          icon={ShieldCheck}
        />
        <StatCard
          label="Drafts"
          value={drafts}
          color="bg-purple-50 text-purple-600"
          icon={FileText}
        />
        <StatCard
          label="Needs Attention"
          value={needsAttention}
          color="bg-amber-50 text-amber-600"
          icon={AlertTriangle}
        />
      </div>

      <AgentsGrid agents={agents} orgId={org.id} />
    </div>
  );
}
