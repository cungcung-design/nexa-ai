"use client";

import { useCallback, useState, FormEvent } from "react";
import { Wand2, Search as SearchIcon, FolderOpen, AlertTriangle, LoaderCircle } from "lucide-react";

type SearchResult = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  score: number;
};

export function KnowledgeSearchPlayground({
  orgId,
  knowledgeBaseId,
}: {
  orgId: string;
  knowledgeBaseId: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (!query.trim()) return;
      setLoading(true);
      setError("");
      try {
        const r = await fetch(
          `/api/workspace/${encodeURIComponent(orgId)}/knowledge/${encodeURIComponent(knowledgeBaseId)}/search`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim(), limit: 5 }),
            credentials: "include",
          }
        );
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Search failed");
        setResults(Array.isArray(d) ? d : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [query, orgId, knowledgeBaseId]
  );

  const handleRetry = useCallback(() => {
    void handleSearch();
  }, [handleSearch]);

  return (
    <div className="bg-[#f4f7fc] text-slate-700 font-sans antialiased min-h-screen p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/85 shadow-lg p-8">
        <div className="flex items-start gap-3.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0">
            <Wand2 className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Test Knowledge Retrieval
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Preview what your AI agent can find.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <label className="text-xs font-bold text-slate-800 block">
            Search question
          </label>
          <textarea
            rows={3}
            placeholder="e.g. What is our refund policy?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSearch();
              }
            }}
            className="w-full bg-white text-xs text-slate-700 p-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none placeholder:text-slate-400"
          />
        </div>

        <div className="mb-8">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SearchIcon className="text-slate-400 text-xs" />
            Run Search
          </button>
        </div>

        {/* Empty State */}
        {!loading && !error && results.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm p-10 flex flex-col items-center justify-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-lg mb-4">
              <FolderOpen className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              No documents yet
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Upload a document to start building your knowledge base.
            </p>
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-400 font-semibold text-xs px-5 py-3 rounded-2xl transition-all cursor-not-allowed">
              Upload Document
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm p-10 flex flex-col items-center justify-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-lg mb-4">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Searching...
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Finding relevant documents in your knowledge base.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm p-10 flex flex-col items-center justify-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-lg mb-4">
              <AlertTriangle className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Processing failed
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              We couldn&rsquo;t process this document. Review the error and try again.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs px-5 py-3 rounded-2xl transition-all"
            >
              Retry Processing
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-xs font-bold text-slate-900">
              Example search results
            </h3>
            {results.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-800">
                    {r.filename}
                  </h4>
                  <span
                    className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full text-[10px]"
                  >
                    {(r.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-xs text-slate-500">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-slate-400 italic pt-4 border-t border-slate-100 text-center">
          Example results only. Actual similarity scores and source snippets must come from the retrieval API.
        </div>
      </div>
    </div>
  );
}
