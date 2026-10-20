"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon, RefreshIcon } from "@/components/audit-logs/icons";

type ExportFormat = "csv" | "json";
type ExportScope = "filtered" | "date_range" | "metadata";

type ExportStatus = {
  export_id: string;
  status: string;
  format: string;
  scope: string;
  record_count: number | null;
  download_url: string | null;
  error: string | null;
  created_at: string;
};

type Props = {
  orgId: string;
  categories: { id: string; name: string }[];
};

const SCOPES: { value: ExportScope; label: string; description: string }[] = [
  {
    value: "filtered",
    label: "Current filtered results",
    description: "Only the records matching the filters below.",
  },
  {
    value: "date_range",
    label: "All events in the selected date range",
    description: "Every event inside the selected dates, ignoring other filters.",
  },
  {
    value: "metadata",
    label: "Filtered results with full metadata",
    description: "Includes the recorded details and change payload for each event.",
  },
];

export function AuditExportPanel({ orgId, categories }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<ExportScope>("filtered");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<(exportId: string) => void>(() => {});

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(
    (exportId: string) => {
      stopPolling();
      timerRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/workspace/${encodeURIComponent(orgId)}/audit-logs/export/${encodeURIComponent(exportId)}`,
            { cache: "no-store" },
          );
          if (!response.ok) {
            setError("Could not read the export status.");
            setPending(false);
            return;
          }
          const next = (await response.json()) as ExportStatus;
          setStatus(next);
          if (next.status === "queued" || next.status === "processing") {
            pollRef.current(exportId);
          } else {
            setPending(false);
          }
        } catch {
          setError("Could not read the export status.");
          setPending(false);
        }
      }, 1200);
    },
    [orgId, stopPolling],
  );

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  async function generate() {
    setPending(true);
    setError(null);
    setStatus(null);

    const body = {
      format,
      scope,
      search: search.trim() || undefined,
      category: category || undefined,
      outcome: outcome || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };

    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/audit-logs/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const detail = await response
          .json()
          .then((body: { error?: string }) => body.error)
          .catch(() => null);
        setError(
          detail ??
            (response.status === 403
              ? "Your role cannot export audit logs. Owners and Admins can."
              : "The export could not be started."),
        );
        setPending(false);
        return;
      }
      const created = (await response.json()) as ExportStatus;
      setStatus(created);
      poll(created.export_id);
    } catch {
      setError("The export could not be started.");
      setPending(false);
    }
  }

  const downloadHref = status?.download_url
    ? `/api/workspace/${encodeURIComponent(orgId)}/audit-logs/export/${encodeURIComponent(status.export_id)}/download`
    : null;

  return (
    <div className="space-y-5">
      <section className="border border-zinc-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3">
          Export Format
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["csv", "json"] as ExportFormat[]).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                format === value
                  ? "border-[#4265db] bg-[#f1f5ff]"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="format"
                value={value}
                checked={format === value}
                onChange={() => setFormat(value)}
                className="mt-0.5 size-4 accent-[#4265db]"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {value.toUpperCase()}
                </span>
                <span className="block text-xs text-zinc-500">
                  {value === "csv"
                    ? "Spreadsheet friendly table with one row per event."
                    : "Structured records including nested details."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="border border-zinc-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3">
          Export Scope
        </h3>
        <div className="space-y-2">
          {SCOPES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                scope === option.value
                  ? "border-[#4265db] bg-[#f1f5ff]"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={option.value}
                checked={scope === option.value}
                onChange={() => setScope(option.value)}
                className="mt-0.5 size-4 accent-[#4265db]"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {option.label}
                </span>
                <span className="block text-xs text-zinc-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">
          Exports respect workspace permissions, field redaction, retention
          policies, and dataset size limits.
        </p>
      </section>

      <section className="border border-zinc-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3">
          Filters
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-medium text-zinc-500">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, reference, actor..."
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-500">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-500">Outcome</span>
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Any outcome</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="denied">Denied</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="w-full h-10 rounded-full border border-transparent bg-[#4265db] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#3654c0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <DownloadIcon className="size-4" />
        {pending ? "Generating export..." : "Generate Export"}
      </button>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {status ? (
        <section className="rounded-xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900">
              Export {status.status}
            </p>
            {status.record_count !== null ? (
              <p className="text-xs text-zinc-500">
                {status.record_count} records
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Reference {status.export_id} · {status.format.toUpperCase()} ·{" "}
            {status.scope}
          </p>
          {status.error ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {status.error}
            </p>
          ) : null}
          {status.status === "completed" && downloadHref ? (
            <a
              href={downloadHref}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <DownloadIcon className="size-4" /> Download {status.format.toUpperCase()}
            </a>
          ) : null}
          {status.status === "queued" || status.status === "processing" ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500">
              <RefreshIcon className="size-3.5 animate-spin" /> Preparing your export...
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
