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
  Trash2,
  Edit3,
} from "lucide-react";

type WebhookDetail = {
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

type FormData = {
  name: string;
  target_url: string;
  events: string;
  secret: string;
  is_active: boolean;
};

export default function WebhookDetailPage() {
  const params = useParams<{
    organizationId: string;
    webhookId: string;
  }>();
  const router = useRouter();
  const [webhook, setWebhook] = useState<WebhookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "",
    target_url: "",
    events: "",
    secret: "",
    is_active: true,
  });

  const loadWebhook = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${params.webhookId}`
      );
      if (!res.ok) throw new Error("Webhook not found");
      const data: WebhookDetail = await res.json();
      setWebhook(data);
      setForm({
        name: data.name,
        target_url: data.target_url,
        events: data.events.join(", "),
        secret: data.has_secret ? "••••••••" : "",
        is_active: data.is_active,
      });
    } catch {
      setError("Unable to load webhook.");
    } finally {
      setLoading(false);
    }
  }, [params.webhookId, params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWebhook();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWebhook]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        target_url: form.target_url,
        events: form.events.split(",").map((e) => e.trim()).filter(Boolean),
        is_active: form.is_active,
      };
      if (form.secret && !form.secret.includes("•")) {
        body.secret = form.secret;
      }
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${params.webhookId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      await loadWebhook();
    } catch {
      setError("Failed to update webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWebhook() {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/webhooks/${params.webhookId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      router.push(
        `/dashboard/organizations/${params.organizationId}/integrations/webhooks`
      );
    } catch {
      setError("Failed to delete webhook.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading webhook...</p>
      </div>
    );
  }

  if (error || !webhook) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>{error || "Webhook not found."}</p>
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
          <h1 className="mt-1 text-xl font-bold text-gray-900">
            {webhook.name}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200/80 bg-white p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Webhook name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Secret
          </label>
          <input
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            placeholder="Leave blank to keep current"
            className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
          />
          <p className="mt-1 text-xs text-gray-400">
            Secret is never returned in responses.
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
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={deleteWebhook}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox label="Connection" value={webhook.connection_name ?? "—"} />
        <StatBox label="Status" value={webhook.is_active ? "Active" : "Inactive"} />
        <StatBox label="Has secret" value={webhook.has_secret ? "Yes" : "No"} />
      </div>

      <Link
        href={`/dashboard/organizations/${params.organizationId}/integrations/webhooks/${webhook.id}/deliveries`}
        className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1"
      >
        <Edit3 className="w-3 h-3" /> View delivery logs
      </Link>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
      <span className="text-xs text-gray-500 block">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
