export function AgentDomainModel() {
  return (
    <div className="bg-white border border-gray-200/80 rounded-3xl shadow-xs p-6">
      <div className="relative w-full h-[520px] max-w-md mx-auto">
        {/* Organization - Top */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-6 w-40 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center shadow-sm"
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
              Organization
            </p>
            <p className="text-xs font-semibold text-purple-900">NEXORA AI</p>
          </div>
        </div>

        {/* AI Agent - Second row */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[110px] w-40 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-sm"
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              AI Agent
            </p>
            <p className="text-xs font-semibold text-blue-900">Customer Support</p>
          </div>
        </div>

        {/* Connector: Organization -> AI Agent */}
        <svg
          className="absolute left-1/2 top-[26px] -translate-x-1/2 w-0.5 h-24"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="24"
            stroke="gray-300"
            strokeWidth="1"
            markerEnd="url(#arrow)"
          />
        </svg>
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="gray-300" />
          </marker>
        </defs>

        {/* Row 3: Versions, Knowledge, Tools */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[170px] w-full flex justify-between px-2"
        >
          <div className="w-20 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-purple-600 uppercase">
                Versions
              </p>
            </div>
          </div>
          <div className="w-20 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-purple-600 uppercase">
                Knowledge
              </p>
            </div>
          </div>
          <div className="w-20 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-purple-600 uppercase">
                Tools
              </p>
            </div>
          </div>
        </div>

        {/* Connectors: AI Agent -> Row 3 */}
        <svg
          className="absolute left-1/2 -translate-x-1/2 top-[122px] w-1 h-48"
        >
          <line x1="0.5" y1="0" x2="0.5" y2="48" stroke="gray-300" strokeWidth="1" />
          <line x1="0.5" y1="0" x2="-40" y2="48" stroke="gray-300" strokeWidth="1" />
          <line x1="0.5" y1="0" x2="40" y2="48" stroke="gray-300" strokeWidth="1" />
        </svg>

        {/* Row 4: Conversations, Executions, Deployments */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[230px] w-full flex justify-between px-2"
        >
          <div className="w-20 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                Conversations
              </p>
            </div>
          </div>
          <div className="w-20 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                Executions
              </p>
            </div>
          </div>
          <div className="w-20 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                Deployments
              </p>
            </div>
          </div>
        </div>

        {/* Connectors: AI Agent -> Row 4 */}
        <svg
          className="absolute left-1/2 -translate-x-1/2 top-[182px] w-1 h-48"
        >
          <line x1="0.5" y1="0" x2="0.5" y2="48" stroke="gray-300" strokeWidth="1" />
          <line x1="0.5" y1="0" x2="-40" y2="48" stroke="gray-300" strokeWidth="1" />
          <line x1="0.5" y1="0" x2="40" y2="48" stroke="gray-300" strokeWidth="1" />
        </svg>

        {/* Analytics & Evaluations - Bottom */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[290px] w-56 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shadow-sm"
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-violet-600 uppercase">
              Analytics &amp; Evaluations
            </p>
          </div>
        </div>

        {/* Connector: Row 4 -> Analytics */}
        <svg className="absolute left-1/2 -translate-x-1/2 top-[242px] w-1 h-48">
          <line x1="0.5" y1="0" x2="0.5" y2="48" stroke="gray-300" strokeWidth="1" />
        </svg>
      </div>

      <p className="mt-6 text-[10px] text-gray-400 italic text-center">
        Conceptual domain model. Exact database relationships must be checked
        against the existing backend.
      </p>
    </div>
  );
}
