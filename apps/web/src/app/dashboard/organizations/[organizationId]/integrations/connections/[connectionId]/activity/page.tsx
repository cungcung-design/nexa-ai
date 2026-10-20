"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

type ActivityItem = {
  id: string;
  action: string;
  connection_id: string | null;
  webhook_id: string | null;
  actor_id: string | null;
  activity_metadata: Record<string, unknown>;
  created_at: string;
};

export default function ConnectionActivityPage() {
  const params = useParams<{ organizationId: string; connectionId: string }>();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/activity`
      );
      if (!res.ok) throw new Error("Unable to load activity");
      const all: ActivityItem[] = await res.json();
      const filtered = all.filter(
        (a) => a.connection_id === params.connectionId
      );
      setActivities(filtered);
    } catch {
      setError("Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }, [params.connectionId, params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActivity();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadActivity]);

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
      <div className="flex items-start justify-between">
        <a
          href={`/dashboard/organizations/${params.organizationId}/integrations/connections/${params.connectionId}`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3 h-3" /> Back to connection
        </a>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Connection Activity
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Activity Log</h1>
        </div>
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
                <th className="px-4 py-3 text-gray-500 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {a.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {a.actor_id ?? "system"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
