"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

type Connection = {
  id: string;
  name: string;
};

type FormData = {
  connection_id: string;
  name: string;
  target_url: string;
  events: string;
  is_active: boolean;
};

export default function NewWebhookPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    connection_id: "",
    name: "",
    target_url: "",
    events: "",
    is_active: true,
  });

  const loadConnections = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/connections`
      );
      if (!res.ok) throw new Error("Unable to load connections");
      setConnections(await res.json());
    } catch {
      setError("Unable to load connections.");
    } finally {
      setLoading(false);
    }
  }, [params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConnections();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadConnections]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        connection_id: form.connection_id,
        name: form.name,
        target_url: form.target_url,
        events: form.events.split(",").map((e) => e.trim()).filter(Boolean),
        is_active: form.is_active,
      };
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to create webhook");
      router.push(
        `/dashboard/organizations/${params.organizationId}/integrations/webhooks`
      );
    } catch {
      setError("Failed to create webhook.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading connections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>{error}</p>
        <Link
          href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks`}
          className="mt-2 inline-block text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3 h-3 mr-1" /> Back to webhooks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Link
          href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3 h-3" /> Back to webhooks
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Webhooks
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">New Webhook</h1>
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-800">
            No connections available. Create a connection first before adding a webhook.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200/80 bg-white p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Connection
            </label>
            <select
              value={form.connection_id}
              onChange={(e) =>
                setForm({ ...form, connection_id: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-gray-50 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">Select a connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Webhook name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Order Events"
              className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Target URL
            </label>
            <input
              value={form.target_url}
              onChange={(e) => setForm({ ...form, target_url: e.target.value })}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Events (comma-separated)
            </label>
            <input
              value={form.events}
              onChange={(e) => setForm({ ...form, events: e.target.value })}
              placeholder="order.created, order.updated"
              className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
            />
            <p className="mt-1 text-xs text-gray-400">
              Example: order.created, order.updated, order.deleted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
              className="rounded border-gray-200/80 text-gray-900 focus:ring-gray-500"
            />
            <label className="text-xs text-gray-700">Active</label>
          </div>
          <button
            type="submit"
            disabled={
              saving ||
              !form.connection_id ||
              !form.name ||
              !form.target_url
            }
            className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Create Webhook
          </button>
        </form>
      )}
    </div>
  );
}
