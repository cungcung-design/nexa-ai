"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Database,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";

export type KnowledgeBase = { id: string; name: string };

type Document = {
  id: string;
  filename: string;
  status: string;
  error_message?: string | null;
};

type SearchResult = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  score: number;
};

function getError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") return d.error;
    if (typeof d.detail === "string") return d.detail;
  }
  return fallback;
}

export function KnowledgeManager({
  orgId,
  initialBases,
  initialSelectedId,
}: {
  orgId: string;
  initialBases: KnowledgeBase[];
  initialSelectedId?: string;
}) {
  const [bases, setBases] = useState(initialBases);
  const [selected, setSelected] = useState(
    initialBases.find((b) => b.id === initialSelectedId)?.id ??
      initialBases[0]?.id ??
      ""
  );
  const [name, setName] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const prefix = `/api/workspace/${encodeURIComponent(orgId)}/knowledge`;

  async function loadDocuments(id = selected) {
    if (!id) {
      setDocuments([]);
      return;
    }
    try {
      const r = await fetch(`${prefix}/${encodeURIComponent(id)}/documents`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getError(d, "Could not load documents"));
      setDocuments(
        Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : []
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
    }
  }

  useEffect(() => {
    void loadDocuments(selected);
    setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, orgId]);

  // Poll only while jobs are pending or processing.
  useEffect(() => {
    if (
      !selected ||
      !documents.some((d) => ["PENDING", "PROCESSING"].includes(d.status))
    )
      return;
    const id = window.setInterval(() => {
      void loadDocuments(selected);
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, documents, orgId]);

  async function createBase(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(prefix, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getError(d, "Creation failed"));
      setBases((b) => [...b, d as KnowledgeBase]);
      setSelected((d as KnowledgeBase).id);
      setName("");
      setNotice("Knowledge base created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !selected) return;
    setError("");
    setNotice("");
    if (file.size > 5_000_000) {
      setError("File exceeds the 5 MB limit.");
      return;
    }
    if (!/\.(pdf|txt)$/i.test(file.name)) {
      setError("Only PDF and TXT are supported.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(
        `${prefix}/${encodeURIComponent(selected)}/documents`,
        { method: "POST", body: form }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(getError(d, "Upload failed"));
      setNotice("Document accepted for processing.");
      await loadDocuments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!selected || !query.trim()) return;
    setSearching(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        `${prefix}/${encodeURIComponent(selected)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), limit: 5 }),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(getError(d, "Search failed"));
      setResults(Array.isArray(d) ? d : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  const selectedBase = bases.find((b) => b.id === selected);

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Database className="size-5 text-violet-400" /> Knowledge bases
        </h2>
        <div className="space-y-2">
          {bases.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setSelected(b.id);
                setError("");
              }}
              className={`w-full rounded-xl border p-3 text-left text-sm ${
                selected === b.id
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                  : "border-white/10 text-zinc-300 hover:bg-white/5"
              }`}
            >
              {b.name}
            </button>
          ))}
          {!bases.length && (
            <p className="text-sm text-zinc-500">No knowledge bases yet.</p>
          )}
        </div>
        <form
          onSubmit={createBase}
          className="space-y-3 border-t border-white/10 pt-4"
        >
          <label className="block text-xs text-zinc-400">
            New knowledge base
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={120}
            required
            placeholder="e.g. Support docs"
            className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-violet-500"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-violet-600 p-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            Create knowledge base
          </button>
        </form>
      </section>

      <div className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedBase ? `Documents — ${selectedBase.name}` : "Documents"}
              </h2>
              <p className="text-xs text-zinc-400">
                Uploaded files and processing status
              </p>
            </div>
            <button
              aria-label="Refresh documents"
              onClick={() => void loadDocuments()}
              disabled={!selected}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
          {selected && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 p-7 text-center">
              <UploadCloud className="size-8 text-violet-400" />
              <span className="text-sm font-medium">
                Choose a PDF or TXT file
              </span>
              <span className="text-xs text-zinc-500">Maximum 5 MB</span>
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void upload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <div className="space-y-2">
            {documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 p-3"
              >
                <FileText className="size-5 shrink-0 text-violet-300" />
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={d.filename}
                >
                  {d.filename}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    d.status === "READY"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : d.status === "FAILED"
                        ? "bg-red-500/10 text-red-300"
                        : "bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
            {selected && !documents.length && (
              <p className="py-6 text-center text-sm text-zinc-500">
                No documents uploaded.
              </p>
            )}
            {!selected && (
              <p className="py-6 text-center text-sm text-zinc-500">
                Create or select a knowledge base.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#14131e] p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Search className="size-5 text-violet-300" /> Search knowledge
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Semantic search across indexed document chunks.
            </p>
          </div>
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              minLength={2}
              required
              disabled={!selected}
              placeholder="What is the company's return policy?"
              className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-violet-500 disabled:opacity-50"
            />
            <button
              disabled={!selected || searching}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {searching && <LoaderCircle className="size-4 animate-spin" />}
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
          <div className="space-y-3">
            {results.map((r) => (
              <article
                key={r.id}
                className="rounded-xl border border-white/10 p-4"
              >
                <p className="text-xs text-zinc-500">
                  {r.filename} · score {r.score.toFixed(3)}
                </p>
                <p className="mt-2 text-sm text-zinc-200">{r.content}</p>
              </article>
            ))}
            {selected && !results.length && !searching && (
              <p className="text-sm text-zinc-500">
                Run a search to inspect indexed chunks.
              </p>
            )}
          </div>
        </section>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-zinc-400 xl:col-span-2">
          <LoaderCircle className="size-4 animate-spin" /> Working...
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300 xl:col-span-2"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300 xl:col-span-2"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
