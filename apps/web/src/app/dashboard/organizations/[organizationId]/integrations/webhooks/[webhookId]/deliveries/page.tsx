"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

type Delivery = {
  id: string;
  event: string;
  status: string;
  response_status: number | null;
  attempted_at: string;
  completed_at: string | null;
};

export default function WebhookDeliveriesPage() {
  const params = useParams<{
    organizationId: string;
    webhookId: string;
  }>();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${params.webhookId}/deliveries`
      );
      if (!res.ok) throw new Error("Unable to load deliveries");
      setDeliveries(await res.json());
    } catch {
      setError("Unable to load delivery logs.");
    } finally {
      setLoading(false);
    }
  }, [params.webhookId, params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDeliveries();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDeliveries]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading deliveries...</p>
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

  const statusVariant = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "failed":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
      default:
        return "bg-gray-50 text-gray-500 border-gray-200/60";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Link
          href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks/${params.webhookId}`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3 h-3" /> Back to webhook
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Webhooks
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Delivery Logs</h1>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-gray-200/80 p-12 text-center">
          <p className="text-gray-500">No delivery logs yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-gray-500 font-semibold">Time</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Event</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Status</th>
                <th className="px-4 py-3 text-gray-500 font-semibold text-right">
                  HTTP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(d.attempted_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {d.event}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${statusVariant(d.status)}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-right">
                    {d.response_status ?? "—"}
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
