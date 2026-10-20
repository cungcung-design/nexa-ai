"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Play,
  Pause,
  Settings,
  Activity,
} from "lucide-react";

type Connection = {
  id: string;
  organization_id: string;
  provider_id: string;
  provider_name?: string | null;
  provider_slug?: string | null;
  provider_auth_type?: string | null;
  provider_capabilities?: string[] | null;
  name: string;
  status: string;
  auth_type: string;
  scopes: string[];
  config: Record<string, unknown>;
  has_credentials: boolean;
  last_tested_at: string | null;
  last_tested_ok: boolean | null;
  created_at: string;
  updated_at: string;
};

export default function ConnectionDetailsPage() {
  const params = useParams<{ organizationId: string; connectionId: string }>();
  const router = useRouter();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    const res = await apiFetch(
      `/api/v1/organizations/${params.organizationId}/integrations/connections/${params.connectionId}`
    );
    if (!res.ok) throw new Error("Connection not found");
    return (await res.json()) as Connection;
  }, [params.connectionId, params.organizationId]);

  useEffect(() => {
    let cancelled = false;
    fetchConnection()
      .then((data) => {
        if (!cancelled) {
          setConnection(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load connection details.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchConnection]);

  async function postAction(action: string) {
    setActionLoading(action);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/connections/${params.connectionId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) throw new Error(`Failed to ${action}`);
      setLoading(true);
      setError(null);
      fetchConnection()
        .then((data) => {
          setConnection(data);
          setLoading(false);
        })
        .catch(() => {
          setError(`Failed to refresh after ${action}.`);
          setLoading(false);
        });
    } catch {
      setError(`Failed to ${action}.`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading connection...</p>
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>{error || "Connection not found."}</p>
      </div>
    );
  }

  const statusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Connection Details
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">
            {connection.name}
          </h1>
          <p className="text-sm text-gray-500">
            {connection.provider_name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => postAction("test")}
            disabled={actionLoading === "test"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === "test" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Test
          </button>
          <button
            onClick={() => postAction("disable")}
            disabled={actionLoading === "disable"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === "disable" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            Disable
          </button>
          <button
            onClick={() => postAction("enable")}
            disabled={actionLoading === "enable"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === "enable" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Enable
          </button>
          <button
            onClick={() => postAction("disconnect")}
            disabled={actionLoading === "disconnect"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-white text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === "disconnect" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Disconnect
          </button>
        </div>
      </div>

      <div
        className={`rounded-lg p-3 border ${
          connection.status === "connected"
            ? "border-emerald-200 bg-emerald-50"
            : connection.status === "unhealthy"
              ? "border-rose-200 bg-rose-50"
              : connection.status === "needs_reauthorization"
                ? "border-amber-200 bg-amber-50"
                : connection.status === "disabled"
                  ? "border-gray-200 bg-gray-50"
                  : "border-blue-200 bg-blue-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connection.status === "connected"
                ? "bg-emerald-500"
                : connection.status === "unhealthy"
                  ? "bg-rose-500"
                  : connection.status === "needs_reauthorization"
                    ? "bg-amber-500"
                    : connection.status === "disabled"
                      ? "bg-gray-400"
                      : "bg-blue-500"
            }`}
          />
          <span className="text-sm font-medium">
            {connection.status === "connected"
              ? "Connected"
              : connection.status === "unhealthy"
                ? "Unhealthy"
                : connection.status === "needs_reauthorization"
                  ? "Needs reauthorization"
                  : connection.status === "disabled"
                    ? "Disabled"
                    : "Connecting"}
          </span>
        </div>
        {connection.last_tested_ok !== null && (
          <p className="mt-1 text-xs text-gray-600">
            Last tested:{connection.last_tested_ok ? " OK" : " Failed"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatRow label="Provider" value={connection.provider_name ?? "—"} />
        <StatRow label="Auth type" value={connection.auth_type} />
        <StatRow label="Status" value={statusLabel(connection.status)} />
        <StatRow
          label="Scopes"
          value={connection.scopes.length
            ? connection.scopes.join(", ")
            : "none"}
        />
        <StatRow label="Has credentials" value={connection.has_credentials ? "Yes" : "No"} />
        <StatRow label="Last tested" value={connection.last_tested_at ?? "Never"} />
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Linked Agents</h3>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200/80 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-3 h-3" /> Link agent
          </button>
        </div>
        <p className="text-xs text-gray-500">
          No agents linked yet. Grant agent access to allow agents to use this
          connection.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Linked Workflows</h3>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200/80 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-3 h-3" /> Link workflow
          </button>
        </div>
        <p className="text-xs text-gray-500">
          No workflows linked yet. Assign this connection to workflow steps.
        </p>
      </div>

      <a
        href={`/dashboard/organizations/${params.organizationId}/integrations/connections/${connection.id}/activity`}
        className="text-xs text-blue-600 font-medium hover:underline"
      >
        <Activity className="w-3 h-3 mr-1" /> View activity
      </a>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 truncate">{value}</span>
    </div>
  );
}
