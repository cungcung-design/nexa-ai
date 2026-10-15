"use client";

import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  RotateCw,
  Shapes,
  TrendingUp,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

type MetricCardData = {
  id: string;
  label: string;
  value: string;
  suffix?: string;
  change: string;
  Icon: SVGIcon;
  iconBg: string;
  iconColor: string;
};

type ActivityStatus = "success" | "failed" | "pending" | "running";

type RecentActivityItem = {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  status: ActivityStatus;
  Icon: SVGIcon;
  iconBg: string;
  iconColor: string;
  dotColor: string;
};

type TopWorkflow = {
  id: string;
  name: string;
  Icon: SVGIcon;
  iconBg: string;
  iconColor: string;
  successRate: string;
  executions: number;
};

type HumanReviewItem = {
  id: string;
  name: string;
  submitted: string;
  count: number;
  badgeBg: string;
  badgeColor: string;
};

type AgentStatusSegment = {
  label: string;
  value: number;
  dotColor: string;
};

type WorkflowExecutionData = {
  successful: number;
  failed: number;
  humanReview: number;
};

const METRIC_CARDS: MetricCardData[] = [
  {
    id: "workflows",
    label: "Active Workflows",
    value: "24",
    change: "12% vs yesterday",
    Icon: Shapes,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    id: "executions",
    label: "Total Executions",
    value: "1.42K",
    change: "18% vs yesterday",
    Icon: WandSparkles,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    id: "success",
    label: "Success Rate",
    value: "96.3%",
    change: "2.4% vs yesterday",
    Icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    id: "time",
    label: "Time Saved",
    value: "320",
    suffix: "h",
    change: "15% vs yesterday",
    Icon: Clock3,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    id: "agents",
    label: "Active AI Agents",
    value: "18",
    change: "8% vs yesterday",
    Icon: Bot,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
];

const RECENT_ACTIVITIES: RecentActivityItem[] = [
  {
    id: "act-1",
    name: "Invoice Processing Automation",
    description: "Executed successfully",
    timestamp: "2m ago",
    status: "success",
    Icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "act-2",
    name: "Employee Onboarding Flow",
    description: "Waiting for human review",
    timestamp: "15m ago",
    status: "pending",
    Icon: Zap,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    dotColor: "bg-amber-400",
  },
  {
    id: "act-3",
    name: "Customer Support Agent",
    description: "Executed successfully",
    timestamp: "1h ago",
    status: "success",
    Icon: Bot,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "act-4",
    name: "Contract Analysis Workflow",
    description: "Execution failed",
    timestamp: "2h ago",
    status: "failed",
    Icon: X,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    dotColor: "bg-rose-500",
  },
  {
    id: "act-5",
    name: "Refund Processing",
    description: "Executed successfully",
    timestamp: "3h ago",
    status: "success",
    Icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    dotColor: "bg-emerald-500",
  },
];

const TOP_WORKFLOWS: TopWorkflow[] = [
  {
    id: "wf-1",
    name: "Invoice Processing Automation",
    Icon: Shapes,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    successRate: "98.6%",
    executions: 432,
  },
  {
    id: "wf-2",
    name: "Employee Onboarding Flow",
    Icon: Zap,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    successRate: "97.1%",
    executions: 278,
  },
  {
    id: "wf-3",
    name: "Contract Analysis Workflow",
    Icon: FileText,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    successRate: "94.3%",
    executions: 193,
  },
  {
    id: "wf-4",
    name: "Customer Support Agent",
    Icon: Bot,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    successRate: "99.2%",
    executions: 168,
  },
  {
    id: "wf-5",
    name: "Refund Processing",
    Icon: RotateCw,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    successRate: "95.0%",
    executions: 145,
  },
];

const REVIEW_QUEUE: HumanReviewItem[] = [
  {
    id: "rq-1",
    name: "Employee Onboarding Flow",
    submitted: "Submitted 15m ago",
    count: 12,
    badgeBg: "bg-orange-100",
    badgeColor: "text-orange-600",
  },
  {
    id: "rq-2",
    name: "Contract Analysis Workflow",
    submitted: "Submitted 32m ago",
    count: 8,
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-600",
  },
  {
    id: "rq-3",
    name: "Purchase Approval Flow",
    submitted: "Submitted 1h ago",
    count: 5,
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-600",
  },
  {
    id: "rq-4",
    name: "Vendor Verification",
    submitted: "Submitted 2h ago",
    count: 3,
    badgeBg: "bg-sky-100",
    badgeColor: "text-sky-600",
  },
];

const AGENT_STATUS_SEGMENTS: AgentStatusSegment[] = [
  { label: "Active", value: 12, dotColor: "bg-emerald-500" },
  { label: "Idle", value: 4, dotColor: "bg-blue-500" },
  { label: "In Review", value: 1, dotColor: "bg-amber-400" },
  { label: "Error", value: 1, dotColor: "bg-rose-500" },
];

const AGENT_TOTAL = 18;

const EXECUTIONS: WorkflowExecutionData = {
  successful: 312,
  failed: 8,
  humanReview: 12,
};

export function MetricCard({ data }: { data: MetricCardData }) {
  const { Icon, label, value, suffix, change, iconBg, iconColor } = data;
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>{label}</span>
          <span
            className={`w-7 h-7 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}
          >
            <Icon className="text-xs" />
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
          {suffix && (
            <span className="text-sm font-normal text-slate-500">{suffix}</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
        <TrendingUp className="text-[10px]" /> {change}
      </div>
    </div>
  );
}

export function ActivityItem({ item }: { item: RecentActivityItem }) {
  const { Icon, name, description, timestamp, iconBg, iconColor, dotColor } = item;
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <span
          className={`w-7 h-7 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shrink-0 mt-0.5`}
        >
          <Icon className="text-xs" />
        </span>
        <div>
          <h4 className="text-xs font-semibold text-slate-800">{name}</h4>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] text-slate-400 block">{timestamp}</span>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor} mt-1`}
        />
      </div>
    </div>
  );
}

export function WorkflowExecutionChart({
  data,
}: {
  data: WorkflowExecutionData;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">
          Workflow Execution Overview
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium mr-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>{" "}
              Successful ({data.successful})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>{" "}
              Failed ({data.failed})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>{" "}
              Human Review ({data.humanReview})
            </span>
          </div>
          <button className="bg-[#f4f7fc] text-slate-600 text-xs px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 font-medium">
            Last 7 Days
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative h-60 w-full mt-4 flex items-end">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
          <div className="border-b border-slate-100 w-full pb-1">400</div>
          <div className="border-b border-slate-100 w-full pb-1">300</div>
          <div className="border-b border-slate-100 w-full pb-1">200</div>
          <div className="border-b border-slate-100 w-full pb-1">100</div>
          <div className="border-b border-slate-100 w-full pb-1">0</div>
        </div>

        <svg
          className="absolute inset-x-0 bottom-6 h-44 w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 600 150"
        >
          <path
            d="M 0,120 Q 100,115 200,118 T 400,115 T 600,125"
            fill="none"
            stroke="#f43f5e"
            strokeWidth={2}
          />
          <path
            d="M 0,135 Q 100,130 200,132 T 400,133 T 600,140"
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
          />
          <path
            d="M 0,90 Q 100,30 200,50 T 400,40 T 600,75"
            fill="none"
            stroke="#2563eb"
            strokeWidth={2.5}
          />
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-slate-400 font-medium px-2">
          <span>May 13</span>
          <span>May 14</span>
          <span>May 15</span>
          <span>May 16</span>
          <span>May 17</span>
          <span>May 18</span>
          <span>May 19</span>
        </div>
      </div>
    </div>
  );
}

export function TopWorkflowsTable({ workflows }: { workflows: TopWorkflow[] }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">
          Top Performing Workflows
        </h2>
        <a href="#" className="text-xs text-blue-600 font-semibold hover:underline">
          View All
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="pb-2.5 font-medium">Workflow</th>
              <th className="pb-2.5 font-medium text-right">Success Rate</th>
              <th className="pb-2.5 font-medium text-right">Executions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700">
            {workflows.map((wf) => {
              const { Icon, name, iconBg, iconColor, successRate, executions } = wf;
              return (
                <tr key={wf.id}>
                  <td className="py-3 flex items-center gap-2 font-medium text-slate-800">
                    <span
                      className={`w-5 h-5 rounded ${iconBg} ${iconColor} flex items-center justify-center`}
                    >
                      <Icon className="text-[10px]" />
                    </span>
                    {name}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-700">
                    {successRate}
                  </td>
                  <td className="py-3 text-right text-slate-500">{executions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HumanReviewQueue({ items }: { items: HumanReviewItem[] }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">Human Review Queue</h2>
        <a href="#" className="text-xs text-blue-600 font-semibold hover:underline">
          View All
        </a>
      </div>
      <div className="space-y-3.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-lg ${item.badgeBg} ${item.badgeColor} text-xs font-bold flex items-center justify-center`}
              >
                {item.count}
              </span>
              <div>
                <h4 className="text-xs font-semibold text-slate-800">
                  {item.name}
                </h4>
                <p className="text-[10px] text-slate-400">{item.submitted}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentStatusGauge({
  summary,
  total,
}: {
  summary: AgentStatusSegment[];
  total: number;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-4">AI Agent Status</h2>

        <div className="relative w-36 h-36 mx-auto my-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-8 border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-8 border-emerald-400 border-t-transparent border-r-transparent rotate-45"></div>
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 block leading-none">
              {total}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Total Agents
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-4 text-xs">
          {summary.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between text-slate-600"
            >
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${seg.dotColor}`}></span>
                {seg.label}
              </span>
              <span className="font-semibold text-slate-800">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-slate-100 text-center">
        <a
          href="#"
          className="text-xs text-blue-600 font-semibold flex items-center justify-center gap-1 hover:underline"
        >
          Manage Agents
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

export function ActivityFeed({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
        <a href="#" className="text-xs text-blue-600 font-semibold hover:underline">
          View All
        </a>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          Welcome back, Arif{" "}
          <span className="inline-block" role="img" aria-label="wave">
            👋
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Here&apos;s what&apos;s happening in your AI operations today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {METRIC_CARDS.map((card) => (
          <MetricCard key={card.id} data={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WorkflowExecutionChart data={EXECUTIONS} />
        <ActivityFeed items={RECENT_ACTIVITIES} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopWorkflowsTable workflows={TOP_WORKFLOWS} />
        <HumanReviewQueue items={REVIEW_QUEUE} />
        <AgentStatusGauge summary={AGENT_STATUS_SEGMENTS} total={AGENT_TOTAL} />
      </div>
    </div>
  );
}
