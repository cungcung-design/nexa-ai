import { backendGet } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";
import { notFound } from "next/navigation";
import Link from "next/link";

type Document = {
  id: string;
  filename: string;
  status: string;
  size?: number;
  created_at?: string;
  error_message?: string | null;
};

function getStatusColor(status: string) {
  const s = status.toUpperCase();
  if (s === "READY") {
    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60", dot: "bg-emerald-500" };
  }
  if (s === "PROCESSING" || s === "PENDING") {
    return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200/60", dot: "bg-purple-500" };
  }
  if (s === "FAILED" || s === "ERROR") {
    return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/60", dot: "bg-rose-500" };
  }
  return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200/60", dot: "bg-slate-500" };
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
  }>;
}) {
  const { organizationId, knowledgeBaseId, documentId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    notFound();
  }

  const document = await backendGet<Document>(
    `/api/v1/organizations/${org.id}/knowledge/${encodeURIComponent(
      knowledgeBaseId
    )}/documents/${encodeURIComponent(documentId)}`
  );

  if (!document) {
    notFound();
  }

  const ext = document.filename.split(".").pop()?.toUpperCase() || "";
  const sizeMB = document.size
    ? (document.size / 1024 / 1024).toFixed(2) + " MB"
    : "—";
  const statusColor = getStatusColor(document.status);

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/organizations/${organizationId}/knowledge?kb=${encodeURIComponent(
                  knowledgeBaseId
                )}`}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-50"
                aria-label="Go back"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-base font-semibold text-gray-900 tracking-tight">
                  {document.filename}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Knowledge Base / Document Details
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
            >
              <span
                className={`w-1.5 h-1.5 mr-1.5 rounded-full ${statusColor.dot}`}
              ></span>
              {document.status.charAt(0).toUpperCase() + document.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Document Preview
            </h3>
            <div className="flex-1 min-h-[240px] bg-gray-50 border border-gray-200/80 rounded-xl p-5 flex flex-col justify-between">
              <div className="text-sm font-medium text-gray-800">
                {document.filename.replace(/\.[^/.]+$/, "") || document.filename}
              </div>
              <div className="text-xs text-gray-500 leading-relaxed max-w-[260px]">
                This area displays a safe preview of the uploaded document, when supported.
              </div>
              <div></div>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Document Information
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">File type</span>
                  <span className="font-medium text-gray-900">{ext}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">File size</span>
                  <span className="font-medium text-gray-900">{sizeMB}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Processing</span>
                  <span className="font-medium text-gray-900">
                    {document.status.charAt(0).toUpperCase() +
                      document.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Chunks</span>
                  <span className="font-medium text-gray-900">—</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Linked agents</span>
                  <span className="font-medium text-gray-900">—</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mt-8">
              <button
                className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium border border-gray-300 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                View Chunks
              </button>
              <button
                className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Test Retrieval
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
