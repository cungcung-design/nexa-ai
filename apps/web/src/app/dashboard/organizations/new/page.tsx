"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data === "object" && data && "error" in data ? (data as { error: string }).error : "Creation failed");
        return;
      }
      const org = data as { id: string };
      router.push(`/dashboard/organizations/${encodeURIComponent(org.id)}`);
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  function normalizeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Plus className="mr-2 size-5 text-indigo-600" /> Create Workspace
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create your first organization to start building AI agents.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Organization name
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              URL slug
            </label>
            <input
              required
              type="text"
              value={slug}
              onChange={(e) => setSlug(normalizeSlug(e.target.value))}
              placeholder="e.g. acme-corp"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
            />
            <p className="text-xs text-slate-400">
              Used in your workspace URL: /dashboard/organizations/{slug}
            </p>
          </div>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? (
              <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <Plus className="size-4" />
            )}
            Create workspace
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-slate-500">
        Already have a workspace?{" "}
        <button
          onClick={() => router.replace("/login")}
          className="font-medium text-indigo-600 hover:text-indigo-700 underline"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
