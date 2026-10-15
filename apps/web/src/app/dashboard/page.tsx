'use client';
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  MessageSquare,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Zap,
  ChevronDown,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { asArray, backendGet, type Organization } from "@/lib/api";
import { WorkspaceCreateForm } from "@/components/workspace-create-form";
import { useDashboard } from "@/lib/dashboard-context";
import { useEffect, useState } from "react";

// Types for dashboard data
type WorkflowExecutionData = {
  successful: number;
  failed: number;
  humanReview: number;
};

type RecentActivityItem = {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  status: "success" | "failed" | "pending" | "running";
};

type TopWorkflow = {
  id: string;
  name: string;
  successRate: number;
  executions: number;
};

type AgentStatus = {
  id: string;
  name: string;
  status: "active" | "idle" | "maintenance" | "error";
};

export default async function DashboardPage() {
  const [isDashboardOverview, setIsDashboardOverview] = useState(true);
  
  // Fetch dashboard data
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkflowExecutionData | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [topWorkflows, setTopWorkflows] = useState<TopWorkflow[]>([]);
  const [humanReviewQueue, setHumanReviewQueue] = useState<any[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // In a real implementation, these would be actual API calls
        // For now, we'll simulate unavailable states as per requirements
        
        // For now, set to null to show unavailable states
        setWorkflowExecutions(null);
        setRecentActivity([]);
        setTopWorkflows([]);
        setHumanReviewQueue([]);
        setAgentStatus([]);
      } catch (err) {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <>
      {/* Dashboard Provider */}
      <div className="min-h-screen dashboard-bg">
        {/* DashboardShell will provide the sidebar and header */}
        <div className="flex min-h-screen">
          {/* The DashboardShell component provides the sidebar structure */}
          {/* We'll override the main content area */}
          <div className="flex-1 min-w-0">
            {/* Custom header for dashboard */}
            <header className="app-header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 px-4 backdrop-blur-xl sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-lg p-2 hover:bg-white/5 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </button>
                <span className="hidden text-zinc-500 sm:inline">
                  Dashboard
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Search field */}
                <div className="relative flex-1 max-w-xs">
                  <label className="sr-only">Search workflows, agents, or knowledge</label>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Zap className="size-4 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search workflows, agents, or knowledge..."
                    className="block w-full pl-10 pr-3 py-2 rounded-lg border border-white/20 bg-transparent text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 sm:text-sm"
                  />
                </div>
                
                {/* Notifications and actions */}
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                    aria-label="Notifications"
                  >
                    <MessageSquare className="size-4" />
                  </button>
                  <button
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                    aria-label="Create new workflow"
                  >
                    <Bot className="size-4" />
                  </button>
                  <button
                    className="grid size-10 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Switch theme"
                  >
                    <Moon className="size-4" />
                  </button>
                </div>
              </div>
            </header>

            {/* Main dashboard content */}
            <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {/* Welcome message */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
                  Welcome back, Arif
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Here's your AI workspace overview
                </p>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-l-full border-2 border-t-white border-b-white w-10 h-10"></div>
                  <p className="mt-4 text-sm text-zinc-400">Loading dashboard...</p>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-6 py-4 text-sm text-red-800">
                  {error}
                </div>
              )}

              {/* KPI Cards */}
              {!loading && (
                <div className="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-5 glass-panel">
                  {/* Active Workflows */}
                  <div className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel-hover">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Active Workflows</span>
                      <Bot className="size-5 text-blue-400" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">
                      —
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      No workflow data available
                    </p>
                  </div>
                  
                  {/* Total Executions */}
                  <div className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel-hover">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Total Executions</span>
                      <Activity className="size-5 text-green-400" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">
                      —
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Execution metrics unavailable
                    </p>
                  </div>
                  
                  {/* Success Rate */}
                  <div className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel-hover">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Success Rate</span>
                      <Gauge className="size-5 text-violet-400" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">
                      —
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Success rate not tracked
                    </p>
                  </div>
                  
                  {/* Time Saved */}
                  <div className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel-hover">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Time Saved</span>
                      <Timer className="size-5 text-orange-400" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">
                      —
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Time savings not calculated
                    </p>
                  </div>
                  
                  {/* Active AI Agents */}
                  <div className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel-hover">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Active AI Agents</span>
                      <Users className="size-5 text-teal-400" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">
                      —
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Agent data unavailable
                    </p>
                  </div>
                </div>
              )}

              {/* Main chart and recent activity */}
              {!loading && (
                <div className="grid gap-6 mb-8 lg:grid-cols-[2fr_1fr]">
                  {/* Workflow Execution Overview */}
                  <section className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-400" />
                        <h2 className="font-semibold text-zinc-100">
                          Workflow Execution Overview
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <button
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/20 text-xs font-medium hover:bg-white/5"
                        >
                          Last 7 days
                          <ChevronDown className="size-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-6">
                      {/* Chart placeholder */}
                      <div className="h-48 rounded-lg border border-dashed border-white/10 bg-white/[.02] flex items-center justify-center">
                        <p className="text-zinc-500 text-sm">
                          Workflow execution chart unavailable<br />
                          No execution data available
                        </p>
                      </div>
                    </div>
                  </section>
                  
                  {/* Recent Activity */}
                  <section className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock3 className="size-5 text-green-400" />
                        <h2 className="font-semibold text-zinc-100">
                          Recent Activity
                        </h2>
                      </div>
                      <Link
                        href="#"
                        className="text-sm text-zinc-400 hover:text-zinc-300"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {/* Activity items placeholder */}
                      <div className="h-48 rounded-lg border border-dashed border-white/10 bg-white/[.02] flex items-center justify-center">
                        <p className="text-zinc-500 text-sm">
                          No recent activity available
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* Bottom sections */}
              {!loading && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Top Performing Workflows */}
                  <section className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-zinc-100">
                        Top Performing Workflows
                      </h2>
                      <Link
                        href="#"
                        className="text-sm text-zinc-400 hover:text-zinc-300"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="mt-4">
                      {/* Workflows list placeholder */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-white/[.02] p-4">
                          <p className="text-zinc-500 text-sm">
                            No workflow data available
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  
                  {/* Human Review Queue */}
                  <section className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-zinc-100">
                        Human Review Queue
                      </h2>
                      <Link
                        href="#"
                        className="text-sm text-zinc-400 hover:text-zinc-300"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="mt-4">
                      {/* Review queue placeholder */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-white/[.02] p-4">
                          <p className="text-zinc-500 text-sm">
                            No pending approvals
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  
                  {/* AI Agent Status */}
                  <section className="rounded-xl border border-white/10 bg-white/[.04] p-6 glass-panel">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-zinc-100">
                        AI Agent Status
                      </h2>
                      <Link
                        href="#"
                        className="text-sm text-zinc-400 hover:text-zinc-300"
                      >
                        Manage Agents
                      </Link>
                    </div>
                    <div className="mt-4">
                      {/* Agent status placeholder */}
                      <div className="h-32 rounded-lg border border-dashed border-white/10 bg-white/[.02] flex items-center justify-center">
                        <p className="text-zinc-500 text-sm">
                          Agent status data unavailable
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

