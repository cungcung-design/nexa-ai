"use client";

import { useState } from "react";
import {
  Archive,
  FileText,
  Flame,
  Layers,
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
  model,
  temperature,
  sources = [],
  promptTokens,
  completionTokens,
}: {
  agentName?: string;
  version?: string;
  model?: string | null;
  temperature?: number | null;
  sources?: { filename?: string; document_id?: string }[];
  promptTokens?: number | null;
  completionTokens?: number | null;
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
            {sources.length > 0 ? (
              sources.map((source, index) => (
                <div
                  key={`${source.document_id ?? source.filename ?? "source"}-${index}`}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      <FileText className="size-3" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {source.filename || "Retrieved document"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-gray-400 italic">
                No sources retrieved for this response.
              </p>
            )}
          </div>
        )}

        {activeTab === "tools" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Tool Execution
            </p>
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
            <p className="text-[10px] text-gray-400 italic">
              Trace details appear after a response is generated.
            </p>
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
                <p className="text-sm font-bold text-gray-900">
                  {promptTokens ?? "—"}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Completion Tokens</p>
                <p className="text-sm font-bold text-gray-900">
                  {completionTokens ?? "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Latency</p>
                <p className="text-sm font-bold text-gray-900">—</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Est. Cost</p>
                <p className="text-sm font-bold text-gray-900">—</p>
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
                <span className="text-xs font-medium text-gray-700">Agent</span>
                <span className="text-xs font-semibold text-gray-900">{agentName || "—"}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Model</span>
                <span className="text-xs font-semibold text-gray-900">{model || "—"}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Temperature</span>
                <span className="text-xs font-semibold text-gray-900">
                  {temperature ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Version</span>
                <span className="text-xs font-semibold text-gray-900">{version || "—"}</span>
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
