"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

export function WorkspaceCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

   async function submit(event: FormEvent) {
     event.preventDefault();
     setBusy(true);
     setError("");
    try {
      const response = await apiFetch("/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          (typeof data.error === "string" && data.error) ||
            "Could not create workspace"
        );
        return;
      }
      setName("");
      setSlug("");
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-white/10 bg-[#14131e] p-6 md:grid-cols-[1fr_1fr_auto]"
    >
      <label className="text-sm font-medium text-zinc-400">
        Organization name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme AI"
          className="mt-1.5 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 outline-none focus:border-violet-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-400">
        Workspace URL
        <input
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="organization-slug"
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          className="mt-1.5 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 outline-none focus:border-violet-500"
        />
      </label>
      <button
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Create
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-400 md:col-span-3">{error}</p>
      )}
    </form>
  );
}
