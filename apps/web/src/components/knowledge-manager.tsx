"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  File,
  FileCode,
  FileText,
  LoaderCircle,
  MoreVertical,
  Search,
  Sliders,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type { KnowledgeBase } from "@/app/dashboard/organizations/[organizationId]/knowledge/page";

type Document = {
  id: string;
  filename: string;
  status: string;
  error_message?: string | null;
  size?: number;
  created_at?: string;
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

async function safeJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Request failed" };
  }
}

function getFileIcon(filename: string): { icon: React.ElementType; color: { bg: string; text: string } } {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    return { icon: FileText, color: { bg: "bg-rose-50", text: "text-rose-600" } };
  }
  if (ext === "md") {
    return { icon: FileCode, color: { bg: "bg-blue-50", text: "text-blue-600" } };
  }
  if (ext === "docx" || ext === "doc") {
    return { icon: FileText, color: { bg: "bg-indigo-50", text: "text-indigo-600" } };
  }
  if (ext === "txt") {
    return { icon: FileText, color: { bg: "bg-slate-50", text: "text-slate-600" } };
  }
  return { icon: FileText, color: { bg: "bg-slate-50", text: "text-slate-600" } };
}

function getFileTypeLabel(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "PDF";
  if (ext === "md") return "Markdown";
  if (ext === "docx" || ext === "doc") return "Word";
  if (ext === "txt") return "TXT";
  return ext ? ext.toUpperCase() : "";
}

function getStatusStyle(status: string): { bg: string; text: string; border: string } {
  const s = status.toUpperCase();
  if (s === "READY") {
    return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" };
  }
  if (s === "PROCESSING" || s === "PENDING") {
    return { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" };
  }
  if (s === "FAILED" || s === "ERROR") {
    return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" };
  }
  return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-100" };
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; filename: string } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const uploadDialogRef = useRef<HTMLDialogElement>(null);

  const prefix = `/api/workspace/${encodeURIComponent(orgId)}/knowledge`;

  const loadDocuments = useCallback(
    async (id = selected) => {
      setResults([]);
      if (!id) {
        setDocuments([]);
        return;
      }
      try {
        const r = await fetch(`${prefix}/${encodeURIComponent(id)}/documents`, {
          cache: "no-store",
          credentials: "include",
        });
        const d = await safeJson(r);
        if (!r.ok) throw new Error(getError(d, "Could not load documents"));
        setDocuments(
          Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : []
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load documents");
      }
    },
    [prefix, selected]
  );

  useEffect(() => {
    async function load() {
      await loadDocuments(selected);
    }
    void load();
  }, [selected, orgId, loadDocuments]);

  useEffect(() => {
    if (
      !selected ||
      !documents.some((d) => ["PENDING", "PROCESSING"].includes(d.status.toUpperCase()))
    )
      return;
    const id = window.setInterval(() => {
      void loadDocuments(selected);
    }, 4000);
    return () => window.clearInterval(id);
  }, [selected, documents, orgId, loadDocuments]);

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
        credentials: "include",
      });
      const d = await safeJson(r);
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

  async function uploadDocument() {
    setError("");
    setNotice("");
    if (!uploadFile) {
      setError("Please select a file to upload.");
      return;
    }
    if (!selected) {
      setError("Please select a knowledge base first.");
      return;
    }
    if (uploadFile.size > 5_000_000) {
      setError("File exceeds the 5 MB limit.");
      return;
    }
    if (!/\.(pdf|txt|md)$/i.test(uploadFile.name)) {
      setError("Only PDF, TXT, and MD files are supported.");
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => {
        setUploadProgress((p) => (p >= 90 ? p : p + 10));
      }, 200);
      const form = new FormData();
      form.append("file", uploadFile);
      const r = await fetch(
        `${prefix}/${encodeURIComponent(selected)}/documents`,
        { method: "POST", body: form, credentials: "include" }
      );
      const d = await safeJson(r);
      if (!r.ok) throw new Error(getError(d, "Upload failed"));
      setUploadProgress(100);
      setNotice("Document accepted for processing.");
      setUploadOpen(false);
      await loadDocuments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setBusy(false);
      setUploadProgress(0);
    }
  }

  async function searchKnowledge(e: FormEvent) {
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
          credentials: "include",
        }
      );
      const d = await safeJson(r);
      if (!r.ok) throw new Error(getError(d, "Search failed"));
      setResults(Array.isArray(d) ? d : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!selected) return;
    try {
      const r = await fetch(
        `${prefix}/${encodeURIComponent(selected)}/documents/${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!r.ok) {
        const d = await safeJson(r);
        throw new Error(getError(d, "Delete failed"));
      }
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      setNotice("Document deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteConfirm(null);
    }
  }

  const readyCount = documents.filter((d) => d.status.toUpperCase() === "READY").length;
  const processingCount = documents.filter(
    (d) => d.status.toUpperCase() === "PROCESSING" || d.status.toUpperCase() === "PENDING"
  ).length;
  const failedCount = documents.filter(
    (d) => d.status.toUpperCase() === "FAILED" || d.status.toUpperCase() === "ERROR"
  ).length;

  const filteredDocuments = documents.filter((d) =>
    d.filename.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-[#f4f7fc] text-slate-700 font-sans antialiased min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] text-slate-400 font-medium mb-1">
              Workspace <span className="mx-1">/</span> Knowledge Base
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage the information your AI agents can use.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            ref={triggerRef}
            className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all w-fit"
          >
            <Upload className="size-3" /> Upload
          </button>
        </div>

        {/* Summary Cards */}
        {selected && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Total Documents</span>
                <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <File className="size-3" />
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {documents.length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Ready</span>
                <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="size-3" />
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {readyCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Processing</span>
                <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <LoaderCircle className="size-3 animate-spin" />
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {processingCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Failed</span>
                <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="size-3" />
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {failedCount}
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Base Selector */}
        {bases.length > 0 && (
          <div className="mb-6">
            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2 block">
              Knowledge Base
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full bg-white text-xs text-slate-700 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
            >
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {bases.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">
                No knowledge bases yet. Create one below.
              </p>
            )}
          </div>
        )}

        {/* Create Knowledge Base Form */}
        {bases.length === 0 && (
          <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-2xs mb-6">
            <form onSubmit={createBase} className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                New knowledge base
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                placeholder="e.g. Support docs"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                disabled={busy || !name.trim()}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {busy ? "Creating..." : "Create knowledge base"}
              </button>
            </form>
          </div>
        )}

        {/* Search and Filters */}
        {selected && (
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white text-xs text-slate-700 pl-9 pr-4 py-2.5 rounded-xl border border-slate-200/80 focus:border-blue-300 focus:bg-white outline-none shadow-2xs transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              type="button"
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2 transition-all shrink-0"
            >
              <Sliders className="size-3" /> Filter
            </button>
          </div>
        )}

        {/* Document Library */}
        {selected && (
          <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-2xs mb-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Document Library</h2>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <button
                  type="button"
                  className="hover:text-slate-700"
                  aria-label="Grid view"
                >
                  <File className="size-4" />
                </button>
                <button
                  type="button"
                  className="text-slate-900 font-semibold"
                  aria-label="List view"
                >
                  <FileText className="size-4" /> List
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((d) => {
                  const { icon: Icon, color } = getFileIcon(d.filename);
                  const status = getStatusStyle(d.status);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50/80 transition-colors group"
                    >
                      <Link
                        href={`/dashboard/organizations/${orgId}/knowledge/${encodeURIComponent(selected)}/documents/${encodeURIComponent(d.id)}`}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-8 h-8 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-xs shrink-0`}>
                          <Icon className="size-3" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 truncate max-w-[200px]">
                            {d.filename}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {getFileTypeLabel(d.filename)} ·
                            {d.size ? (d.size / 1024 / 1024).toFixed(2) + " MB" : "—"}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-semibold px-2.5 py-0.5 rounded-md text-[10px] ${status.bg} ${status.text} border ${status.border}`}
                        >
                          {d.status}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ id: d.id, filename: d.filename })}
                            aria-label={`Delete ${d.filename}`}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="size-3" />
                          </button>
                          <MoreVertical
                            className="size-3 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">
                  No documents uploaded.
                </div>
              )}
            </div>
          </div>
        )}

{/* Test Knowledge Retrieval */}
        {selected && (
          <div className="bg-white rounded-3xl border border-slate-200/85 shadow-lg p-8">
            <div className="flex items-start gap-3.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0">
                <WandSparkles className="text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Test Knowledge Retrieval</h2>
                <p className="text-xs text-slate-400 mt-0.5">Preview what your AI agent can find.</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <label className="text-xs font-bold text-slate-800 block">Search question</label>
              <textarea
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                minLength={2}
                disabled={searching}
                placeholder="e.g. What is our refund policy?"
                className="w-full bg-white text-xs text-slate-700 p-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>

            <div className="mb-8">
              <button
                type="button"
                disabled={searching || !query.trim()}
                onClick={searchKnowledge}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Search className="text-slate-400 text-xs" /> Run Search
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-xs font-bold text-slate-900">Example search results</h3>
              {results.length > 0 ? (
                results.map((r) => {
                  const pct = Math.round((r.score ?? 0) * 100);
                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                          {r.filename}
                        </h4>
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full text-[10px]">
                          {pct}% match
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.content}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400">
                  Run a search to inspect indexed chunks.
                </p>
              )}
            </div>

            <div className="text-[11px] text-slate-400 italic pt-4 border-t border-slate-100 text-center">
              Example results only. Actual similarity scores and source snippets must come from the retrieval API.
            </div>
          </div>
        )}

        {/* Global states */}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <LoaderCircle className="size-4 animate-spin" /> Working...
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {notice}
          </p>
        )}

        {/* Upload Dialog */}
        <dialog
          ref={uploadDialogRef}
          open={uploadOpen}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,36rem)] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
          onClose={() => {
            setUploadOpen(false);
            setUploadFile(null);
            setUploadProgress(0);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              uploadDialogRef.current?.close();
            }
          }}
        >
          <div className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Upload Documents</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  uploadDialogRef.current?.close();
                }}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="text-xs" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Add files to make their content available for AI retrieval.
            </p>

            <div className="border-2 border-dashed border-indigo-200/80 bg-indigo-50/20 rounded-2xl p-8 text-center flex flex-col items-center justify-center mb-5 relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base mb-3 shadow-2xs">
                <Upload className="text-base" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Drag and drop files here
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Or choose files from your device
              </p>
              <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer">
                Browse Files
                <input
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] ?? null);
                  }}
                />
              </label>
              <span className="text-[10px] text-slate-400 mt-4">
                Allowed file types and size limits depend on your backend configuration
              </span>
            </div>

            <div className="mb-6 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Upload queue</h4>
              {uploadFile ? (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 font-medium text-slate-800">
                      <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px]">
                        <FileText className="text-[10px]" />
                      </div>
                      <span className="truncate max-w-[180px]">{uploadFile.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{busy ? "Uploading" : "Ready"}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress || 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 text-[11px] text-slate-400">
                  No files queued yet.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mb-4">
              <button
                type="button"
                onClick={() => {
                  uploadDialogRef.current?.close();
                  setUploadFile(null);
                  setUploadProgress(0);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!uploadFile || busy}
                onClick={uploadDocument}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {busy ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  "Upload Files"
                )}
              </button>
            </div>
          </div>
        </dialog>

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <dialog
            open
            className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,20rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
            onClose={() => setDeleteConfirm(null)}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setDeleteConfirm(null);
              }
            }}
          >
            <div className="p-6 sm:p-7">
              <h2 className="text-sm font-bold text-slate-900">Delete Document</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Are you sure you want to delete &quot;{deleteConfirm.filename}&quot;?
              </p>
              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteDocument(deleteConfirm.id)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-md transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </dialog>
        )}
      </div>
    </div>
  );
}
