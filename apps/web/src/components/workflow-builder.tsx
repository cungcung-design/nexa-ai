"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  Circle,
  CircleHelp,
  CloudUpload,
  Coins,
  Database,
  Eye,
  FileText,
  Grid2x2,
  Hand,
  Heart,
  Linkedin,
  MessageSquare,
  Minus,
  MoreVertical,
  MousePointer,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sliders,
  Square,
  Timer,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { Agent, Organization } from "@/lib/api";
import type { Approval } from "@/components/workflow-center";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

type WorkflowBuilderProps = {
  org: Organization | null;
  orgId: string;
  agents: Agent[];
  initialApprovals: Approval[];
  canReview: boolean;
};

type Metric = {
  icon: React.ReactNode;
  value: string;
};

function NodeCard({
  icon: Icon,
  iconBg,
  iconColor,
  badgeText,
  badgeBg,
  title,
  subtitle,
  metrics,
  ringColor,
  isDraft = true,
}: {
  icon: SVGIcon;
  iconBg: string;
  iconColor: string;
  badgeText?: string;
  badgeBg?: string;
  title: string;
  subtitle: string;
  metrics?: Metric[];
  ringColor?: string;
  isDraft?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs w-64 relative ${ringColor ?? ""}`}
    >
      {isDraft && badgeText && (
        <span
          className={`absolute -top-2.5 right-3 text-[9px] font-semibold px-2 py-0.5 rounded border ${badgeBg ?? "bg-emerald-50 text-emerald-600 border-emerald-100"}`}
        >
          {badgeText}
        </span>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <div className={`w-6 h-6 rounded ${iconBg} ${iconColor} flex items-center justify-center text-[10px] mt-0.5`}>
            <Icon className="size-3" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">{title}</h4>
            <p className="text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <MoreVertical className="text-slate-400 text-xs mt-1" />
      </div>
      {metrics && metrics.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-500 font-medium">
          {metrics.map((m, i) => (
            <span key={i} className="flex items-center gap-1">
              {m.icon}
              <span>{m.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const metricIcons = {
  eye: <Eye className="size-2.5 text-slate-400" />,
  comment: <MessageSquare className="size-2.5 text-slate-400" />,
  heart: <Heart className="size-2.5" />,
  coins: <Coins className="size-2.5" />,
};

function makeMetrics(data: { eye: string; comment: string; heart: string; heartColor: string; coins: string; coinsColor: string }): Metric[] {
  return [
    { icon: metricIcons.eye, value: data.eye },
    { icon: metricIcons.comment, value: data.comment },
    { icon: <Heart className={`size-2.5 ${data.heartColor}`} />, value: data.heart },
    { icon: <Coins className={`size-2.5 ${data.coinsColor}`} />, value: data.coins },
  ];
}

export function WorkflowBuilder({
  org,
  orgId: _orgId,
  agents: _agents,
  initialApprovals: _initialApprovals,
  canReview: _canReview,
}: WorkflowBuilderProps) {
  const [env, setEnv] = useState("Production");
  const [temp, setTemp] = useState(7);

  const navOrg = org;

  return (
    <div className="bg-[#f0f3f8] text-slate-700 font-sans antialiased h-[calc(100vh-4rem-4rem)] overflow-hidden flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <Zap className="size-3" />
            </div>
            <span className="font-bold text-base text-slate-900 tracking-tight">Synthex</span>
          </div>

          <div className="hidden xl:flex items-center gap-3 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span> Build
            </div>
            <div className="w-8 h-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">2</span> Add Sender Profiles
            </div>
            <div className="w-8 h-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px]">3</span> Add Contacts
            </div>
            <div className="w-8 h-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px]">4</span> Launch
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={navOrg ? `/dashboard/organizations/${encodeURIComponent(navOrg.id)}` : "/dashboard"}
            className="text-xs font-medium text-slate-600 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="size-3" /> Back
          </Link>
          <button className="text-xs font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-1.5">
            Next step <ArrowRight className="size-3" />
          </button>
          <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <Timer className="size-3" /> Last save 2 mins ago
          </div>
          <button className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 text-xs transition-colors">
            <RotateCw className="size-3.5" />
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all">
            Publish
          </button>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120"
            alt="Avatar"
            className="w-8 h-8 rounded-full object-cover ml-1"
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 bg-[#f4f7fc] relative flex flex-col overflow-hidden">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs text-xs text-slate-500">
            <button className="hover:text-slate-950"><RotateCw className="size-3.5" /></button>
            <button className="hover:text-slate-950"><RefreshCw className="size-3.5" /></button>
            <div className="h-3 w-[1px] bg-slate-200"></div>
            <button className="hover:text-slate-950"><Minus className="size-3.5" /></button>
            <span className="font-medium text-slate-700">100%</span>
            <button className="hover:text-slate-950"><Plus className="size-3.5" /></button>
            <div className="h-3 w-[1px] bg-slate-200"></div>
            <button className="hover:text-slate-950"><Grid2x2 className="size-3.5" /></button>
            <button className="hover:text-slate-950"><Square className="size-3.5" /></button>
          </div>

          <div className="absolute top-4 right-4 z-10 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs text-xs text-slate-600 font-medium flex items-center gap-2">
            <FileText className="size-3.5 text-slate-400" /> View Logs
          </div>

          <div className="flex-1 overflow-auto p-12 flex flex-col items-center select-none relative">
            <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-xs w-72 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">
                    <Linkedin className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Automation start</h4>
                    <p className="text-[10px] text-slate-400">Initializing for Automation</p>
                  </div>
                </div>
                <MoreVertical className="text-slate-400 text-xs" />
              </div>
            </div>

            <div className="flex justify-between w-96 text-[10px] font-semibold text-amber-600 my-2 px-4 relative z-0">
              <span className="bg-[#f4f7fc] px-1">Initialize Data</span>
              <span className="bg-[#f4f7fc] px-1">Setup Automation</span>
            </div>

            <div className="flex items-start gap-32 relative z-10">
              <NodeCard
                icon={Database}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                badgeText="Draft"
                badgeBg="bg-emerald-50 text-emerald-600 border-emerald-100"
                title="Data Collection"
                subtitle="Gathering Data Connected"
                metrics={makeMetrics({ eye: "11", comment: "27", heart: "41", heartColor: "text-emerald-500", coins: "72", coinsColor: "text-amber-500" })}
              />
              <NodeCard
                icon={WandSparkles}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
                badgeText="Draft"
                badgeBg="bg-emerald-50 text-emerald-600 border-emerald-100"
                title="Trigger Automation"
                subtitle="Workflows on Triggers"
                metrics={makeMetrics({ eye: "11", comment: "27", heart: "41", heartColor: "text-emerald-500", coins: "72", coinsColor: "text-amber-500" })}
                ringColor="ring-2 ring-emerald-500/30"
              />
            </div>

            <div className="text-[10px] font-semibold text-amber-600 my-3 bg-[#f4f7fc] px-2 relative z-0">
              Combine Results
            </div>

            <NodeCard
              icon={ShieldCheck}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              badgeText="Draft"
              badgeBg="bg-emerald-50 text-emerald-600 border-emerald-100"
              title="Data Validation"
              subtitle="Ensuring Data Accuracy"
              metrics={makeMetrics({ eye: "91", comment: "18", heart: "20", heartColor: "text-rose-500", coins: "21", coinsColor: "text-purple-500" })}
            />

            <NodeCard
              icon={Zap}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              badgeText="Draft"
              badgeBg="bg-emerald-50 text-emerald-600 border-emerald-100"
              title="Action Trigger"
              subtitle="Performing Tasks Conditions"
              metrics={makeMetrics({ eye: "87", comment: "34", heart: "17", heartColor: "text-rose-500", coins: "18", coinsColor: "text-purple-500" })}
            />

            <NodeCard
              icon={CloudUpload}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              badgeText="Draft"
              badgeBg="bg-blue-50 text-blue-600 border-blue-100"
              title="Output Generation"
              subtitle="Compiling Delivering Outputs"
              metrics={makeMetrics({ eye: "15", comment: "55", heart: "41", heartColor: "text-emerald-500", coins: "69", coinsColor: "text-blue-500" })}
            />

            <NodeCard
              icon={Check}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              title="Action Completion"
              subtitle="Automation Complete"
              isDraft={false}
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl border border-slate-200/80 shadow-md flex items-center gap-4 text-sm text-slate-600 z-10">
            <button className="hover:text-blue-600"><MousePointer className="size-4" /></button>
            <button className="hover:text-blue-600"><Hand className="size-4" /></button>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <button className="hover:text-blue-600"><Sliders className="size-4" /></button>
            <button className="hover:text-blue-600"><Circle className="size-4" /></button>
            <button className="hover:text-blue-600"><Grid2x2 className="size-4" /></button>
          </div>
        </main>

        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between p-4 shrink-0 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Automation Flow</h3>
                <p className="text-[10px] text-slate-400">Health and Performance</p>
              </div>
              <X className="size-3 text-slate-400 cursor-pointer hover:text-slate-600" />
            </div>

            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-800">Real-time Metrics</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Throughput</span>
                  <span className="font-bold text-slate-800">142 req/min</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Error rate</span>
                  <span className="font-bold text-slate-800">1.2%</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <svg className="w-28 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 100 30">
                  <path d="M0 20 Q 25 5, 50 25 T 100 10" />
                </svg>
                <svg className="w-28 h-6 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 100 30">
                  <path d="M0 15 Q 25 25, 50 10 T 100 20" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-slate-800">Model Status</h4>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50/50 border border-emerald-100 px-3 py-2 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  Core AI Model: <strong className="text-emerald-700">Stable, Latency 15ms</strong>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-800">Environment Context</h4>
                <ChevronUp className="size-3 text-slate-400 cursor-pointer hover:text-slate-600" />
              </div>
              <label className="text-[10px] text-slate-400 block">Environment</label>
              <div className="relative">
                <select
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700 outline-none appearance-none"
                >
                  <option>Production</option>
                  <option>Staging</option>
                  <option>Development</option>
                </select>
                <ChevronUp className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none rotate-180" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-800">Normalized Output</h4>
                <ChevronUp className="size-3 text-slate-400 cursor-pointer hover:text-slate-600" />
              </div>
              <div className="bg-slate-900 text-slate-200 font-mono text-[10px] p-3 rounded-xl relative">
                <span className="absolute top-2 right-2 text-[9px] text-slate-400 uppercase tracking-wider">Read-only</span>
                <p>{`{ service_name, priority_level, environment, error_message }`}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-800">Temperature (Creativity)</h4>
                <CircleHelp className="size-3 text-slate-400 cursor-pointer" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">0.7</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400">1.0</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-800">Dependency Tree</h4>
                <ChevronUp className="size-3 text-slate-400 cursor-pointer hover:text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-400">Mapped fields by mapped data</p>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mapping</div>
                <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] shadow-2xs font-mono">⤹ {`{service_name}`}</div>
                <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] shadow-2xs font-mono">⤹ {`{priority_level}`}</div>
                <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] shadow-2xs font-mono">⤹ {`{environment}`}</div>
                <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] shadow-2xs font-mono">⤹ {`{error_message}`}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all">
              Apply Normalization
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
