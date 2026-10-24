import Link from "next/link";
import { notFound } from "next/navigation";
import { backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const agent = await backendGet<Agent>(
    `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`,
    { revalidate: 0 }
  );
  if (!agent || agent.id !== agentId) notFound();

  const isPublished = !!agent.published_version_id && !agent.is_archived;
  const statusText = agent.is_archived ? "Archived" : isPublished ? "Published" : "Draft";
  const version = agent.latest_version_number ?? 1;
  const base = `/dashboard/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`;

  return (
    <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-gray-100 mb-6">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">
                {agent.name}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isPublished
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : agent.is_archived
                    ? "bg-gray-100 text-gray-600 border border-gray-200/60"
                    : "bg-gray-100 text-gray-600 border border-gray-200/60"
              }`}>
                {statusText}
              </span>
              <span className="text-xs text-gray-400 font-mono">v{version}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {agent.description || "No description yet."}
            </p>
          </div>
        </div>
        <Link
          href={`${base}/studio`}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          Configure
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4 mb-8 pb-6 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Requests</p>
          <p className="text-xl font-bold text-gray-900 tracking-tight">8,420</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Success</p>
          <p className="text-xl font-bold text-gray-900 tracking-tight">99.1%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Avg. Latency</p>
          <p className="text-xl font-bold text-gray-900 tracking-tight">0.9s</p>
        </div>
      </div>

      {/* Connected Resources Section */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Connected Resources
        </h3>

        <div className="space-y-3">
          <Link
            href={`${base}/studio`}
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 tracking-tight">Knowledge Base</h4>
                <p className="text-xs text-gray-500 mt-0.5">3 linked sources</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href={`${base}/studio`}
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 tracking-tight">Tools</h4>
                <p className="text-xs text-gray-500 mt-0.5">2 enabled tools</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/dashboard/organizations/{org.id}/workflows"
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 tracking-tight">Workflows</h4>
                <p className="text-xs text-gray-500 mt-0.5">1 connected workflow</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href={`${base}/deployments`}
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/60 border border-gray-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </span>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 tracking-tight">Deployments</h4>
                <p className="text-xs text-gray-500 mt-0.5">Web widget and API</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Example data for Figma only.
        </p>
      </div>
    </div>
  );
}
