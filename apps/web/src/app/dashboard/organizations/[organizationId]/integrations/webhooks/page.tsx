"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import {
  AlertCircle,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  Play,
} from "lucide-react";

type Webhook = {
  id: string;
  connection_id: string;
  connection_name?: string | null;
  name: string;
  target_url: string;
  events: string[];
  has_secret: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function WebhooksPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks`
      );
      if (!res.ok) throw new Error("Unable to load webhooks");
      setWebhooks(await res.json());
    } catch {
      setError("Unable to load webhooks.");
    } finally {
      setLoading(false);
    }
  }, [params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWebhooks();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWebhooks]);

  async function deleteWebhook(id: string) {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      await loadWebhooks();
    } catch {
      setError("Failed to delete webhook.");
    }
  }

  async function deliverTest(id: string) {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${id}/deliver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) throw new Error("Delivery test failed");
      const data = await res.json();
      alert(
        `Delivery test ${(data as { status: string }).status}. Status: ${(data as { response_status: number | null }).response_status ?? "n/a"}`
      );
      await loadWebhooks();
    } catch {
      setError("Delivery test failed.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading webhooks...</p>
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
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Webhooks
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">
            Event Subscriptions
          </h1>
          <p className="text-sm text-gray-500">
            Configure webhook subscriptions and inspect delivery results.
          </p>
        </div>
        <Link
          href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks/new`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Webhook
        </Link>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-xl border border-gray-200/80 p-12 text-center">
          <p className="text-gray-500">No webhooks configured yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-gray-500 font-semibold">Name</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Connection</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">URL</th>
                <th className="px-4 py-3 text-gray-500 font-semibold">Events</th>
                <th className="px-4 py-3 text-gray-500 font-semibold text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{w.name}</div>
                    <div className="text-xs text-gray-500">
                      {w.is_active ? "Active" : "Inactive"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {w.connection_name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-xs">
                    {w.target_url}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span key={e} className="px-2 py-0.5 rounded border border-gray-200/80 bg-gray-50 text-xs text-gray-600">
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks/${w.id}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => deliverTest(w.id)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600"
                        title="Test delivery"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteWebhook(w.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
