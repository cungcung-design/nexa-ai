"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  FileText,
  Flame,
  Layers,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";

const INSPECTOR_TABS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "sources", label: "Sources", icon: Search },
  { id: "tools", label: "Tools", icon: Flame },
  { id: "trace", label: "Trace", icon: Layers },
  { id: "usage", label: "Usage", icon: TrendingUp },
  { id: "context", label: "Context", icon: Archive },
];

export function AgentPlaygroundInspector({
  agentName,
  version,
}: {
  agentName?: string;
  version?: string;
}) {
  const [activeTab, setActiveTab] = useState("sources");

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex gap-1 border-b border-gray-200/80 pb-2">
        {INSPECTOR_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {activeTab === "sources" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Retrieved Documents
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  <FileText className="size-3" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Support Policy Handbook
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Refund eligibility and processing timeline
                  </p>
                  <Link
                    href="/dashboard/organizations/1/knowledge/1/documents/1"
                    className="text-xs text-indigo-600 hover:underline font-medium mt-1 inline-block"
                  >
                    Open document →
                  </Link>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              No sources retrieved for this response.
            </p>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Tool Execution
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  <RefreshCw className="size-3" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    knowledge_base_search
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Query: refund policy
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Completed
                    </span>
                    <span className="text-xs text-gray-400">120ms</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              No tool executions recorded yet.
            </p>
          </div>
        )}

        {activeTab === "trace" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Execution Timeline
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Message received</div>
                  <div className="text-gray-500">12:00:01</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs border-l border-gray-200 pl-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Knowledge search</div>
                  <div className="text-gray-500">120ms</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs border-l border-gray-200 pl-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">LLM generation</div>
                  <div className="text-gray-500">850ms</div>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/organizations/1/analytics/traces/1"
              className="text-xs text-indigo-600 hover:underline font-medium inline-block"
            >
              View full trace →
            </Link>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Token Usage & Cost
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Prompt Tokens</p>
                <p className="text-sm font-bold text-gray-900">450</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Completion Tokens</p>
                <p className="text-sm font-bold text-gray-900">120</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Latency</p>
                <p className="text-sm font-bold text-gray-900">970ms</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Est. Cost</p>
                <p className="text-sm font-bold text-gray-900">$0.0012</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "context" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Conversation Context
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Window Size</span>
                <span className="text-xs font-semibold text-gray-900">10 messages</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Memory Retention</span>
                <span className="text-xs font-semibold text-gray-900">30 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Organization Policy</span>
                <span className="text-xs font-semibold text-gray-900">Standard</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Context and memory diagnostics appear here during active sessions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
