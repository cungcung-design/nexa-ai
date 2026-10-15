"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

export default function NewAgentPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(params.organizationId)}/agents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create agent");
      router.push(
        `/dashboard/organizations/${params.organizationId}/agents/${(data as { id: string }).id}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create agent"
      );
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
          Agent Studio
        </p>
        <h1 className="mt-2 text-3xl font-bold">New agent</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start a draft. Publishing a configuration comes after you save a
          version.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-6"
      >
        <label className="block text-sm font-medium text-zinc-400">
          Agent name
          <input
            required
            minLength={2}
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Customer support"
            className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-2.5 outline-none focus:border-violet-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-400">
          Description
          <textarea
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this agent do?"
            rows={4}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-violet-500"
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Creating..." : "Create agent"}
        </button>
      </form>
    </div>
  );
}
