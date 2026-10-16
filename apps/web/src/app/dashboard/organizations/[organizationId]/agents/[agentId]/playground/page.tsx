import { notFound } from "next/navigation";
import { backendGet, type Agent } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { AgentPlaygroundInspector } from "@/components/agent-playground-inspector";

export default async function AgentPlaygroundPage({
  params,
}: {
  params: Promise<{ organizationId: string; agentId: string }>;
}) {
  const { organizationId, agentId } = await params;
  const org = await authorizedOrganization(organizationId);
  if (!org) notFound();

  const agent = await backendGet<Agent>(
    `/api/v1/organizations/${org.id}/agents/${encodeURIComponent(agentId)}`
  );
  if (!agent || agent.id !== agentId) notFound();

  const isDraft = !agent.published_version_id || agent.is_archived === true;

  return (
    <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-gray-100 mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            AI Playground
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Test agent responses and inspect execution behavior.
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          isDraft
            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
        }`}>
          {isDraft ? "Draft" : "Published"} v{agent.latest_version_number ?? 1}
        </span>
      </div>

      {/* Agent Selector & Reset Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <select className="w-full appearance-none bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 cursor-pointer shadow-2xs">
            <option value={agent.id}>{agent.name}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        <button
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 hover:text-gray-900 transition-colors cursor-pointer shadow-2xs" aria-label="Reset chat"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chat Area */}
        <div className="flex-1 min-w-0 space-y-4 mb-8 min-h-[220px]">
          <div className="flex justify-end">
            <div className="bg-indigo-50 border border-indigo-100/60 rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs text-indigo-900 max-w-[80%] shadow-2xs">
              What is your refund policy?
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 flex-shrink-0 mt-0.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </span>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl rounded-tl-xs p-4 text-xs text-gray-800 max-w-[85%] shadow-2xs space-y-3">
              <p className="leading-relaxed">
                I found relevant information in the approved refund policy
                document.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200/80 rounded-lg text-[11px] text-gray-600 font-medium shadow-2xs">
                <svg
                  className="w-3.5 h-3.5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                1 source
              </div>
            </div>
          </div>

          {/* Message Input Bar */}
          <div className="flex items-center gap-2 mb-4 relative">
            <input
              type="text"
              placeholder="Send a test message..."
              className="w-full bg-white border border-gray-200/85 rounded-xl pl-4 pr-12 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs"
            />
            <button
              className="absolute right-2 p-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
              aria-label="Send message"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="lg:w-96 shrink-0">
          <AgentPlaygroundInspector
            agentName={agent.name}
            version={agent.latest_version_number?.toString()}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 mt-auto">
        <p className="text-xs text-gray-400">
          Connect source links to Knowledge Base documents, approval links to
          the relevant approval requests, and trace links to execution details.
        </p>
      </div>
    </div>
  );
}
