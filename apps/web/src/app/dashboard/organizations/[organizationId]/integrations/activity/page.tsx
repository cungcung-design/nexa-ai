"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { AlertCircle, Loader2 } from "lucide-react";

type ActivityItem = {
  id: string;
  action: string;
  connection_id: string | null;
  webhook_id: string | null;
  actor_id: string | null;
  activity_metadata: Record<string, unknown>;
  created_at: string;
};

export default function ActivityPage() {
  const params = useParams<{ organizationId: string }>();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/activity`
      );
      if (!res.ok) throw new Error("Unable to load activity");
      setActivities(await res.json());
    } catch {
      setError("Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }, [params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActivity();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadActivity]);

  const actionLabel = (action: string) =>
    action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Activity
        </p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">
          Integration Activity
        </h1>
        <p className="text-sm text-gray-500">
          Investigate integration activity across your workspace.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-gray-200/80 p-12 text-center">
          <p className="text-gray-500">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-gray-500 font-semibold">Time</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Action</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Resource</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((a) => {
                const resource = a.connection_id
                  ? `Connection ${a.connection_id.slice(0, 8)}`
                  : a.webhook_id
                    ? `Webhook ${a.webhook_id.slice(0, 8)}`
                    : "System";
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {actionLabel(a.action)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{resource}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.actor_id ?? "system"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
