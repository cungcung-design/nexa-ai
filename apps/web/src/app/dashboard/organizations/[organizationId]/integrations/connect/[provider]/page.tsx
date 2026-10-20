"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import {
  AlertCircle,
  Loader2,
  Save,
  ShieldAlert,
} from "lucide-react";

type Provider = {
  id: string;
  name: string;
  slug: string;
  description: string;
  auth_type: string;
  capabilities: string[];
  is_active: boolean;
};

type Credentials = Record<string, string>;

export default function ConnectPage() {
  const params = useParams<{ organizationId: string; provider: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>({});

  const loadProvider = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/providers/${params.provider}`
      );
      if (!res.ok) throw new Error("Provider not found");
      const data: Provider = await res.json();
      setProvider(data);
    } catch {
      setError("Unable to load provider details.");
    } finally {
      setLoading(false);
    }
  }, [params.provider, params.organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProvider();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProvider]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: `${provider?.name} Connection`,
        credentials,
        config: {},
        scopes: provider?.capabilities ?? [],
      };
      const res = await apiFetch(
        `/api/v1/organizations/${params.organizationId}/integrations/connections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to create connection");
      const data = await res.json();
      router.push(
        `/dashboard/organizations/${params.organizationId}/integrations/connections/${(data as { id: string }).id}`
      );
    } catch {
      setError("Failed to connect provider.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-2 text-sm text-gray-500">Loading provider...</p>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>{error || "Provider not found."}</p>
      </div>
    );
  }

  const isOAuth = provider.auth_type === "oauth";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Connect {provider.name}
        </p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">
          Connection Setup
        </h1>
        <p className="text-sm text-gray-500">
          Authenticate and configure your {provider.name} connection.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">
              Provider
            </p>
            <p className="text-sm font-semibold text-gray-900">{provider.name}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">
              Authentication
            </p>
            <p className="text-sm text-gray-700">
              {isOAuth ? "OAuth 2.0" : "API Key"} credential flow
            </p>
          </div>

          {isOAuth ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <p className="mt-1 text-sm text-amber-800">
                OAuth setup for {provider.name} requires a configured OAuth
                client. Contact your administrator to enable this provider.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Connection name
                </label>
                <input
                  defaultValue={`${provider.name} Connection`}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-gray-50 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  API credentials
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      name="api_key"
                      onChange={(e) =>
                        setCredentials((c) => ({ ...c, api_key: e.target.value }))
                      }
                      placeholder="Enter API key"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Connect
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
