export type AnalyticsTrace = {
  id: string;
  agent_id: string;
  agent_name?: string | null;
  model?: string | null;
  status: string;
  error_code?: string | null;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  created_at: string;
};

export type AnalyticsSummary = {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type DayBucket = {
  key: string;
  label: string;
  successful: number;
  failed: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function utcDayKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function summarizeTraces(traces: AnalyticsTrace[]): AnalyticsSummary {
  const total = traces.length;
  const successful = traces.filter((trace) => trace.status === "success").length;
  const failed = total - successful;
  const latency = traces.reduce((sum, trace) => sum + trace.latency_ms, 0);
  const promptTokens = traces.reduce((sum, trace) => sum + trace.prompt_tokens, 0);
  const completionTokens = traces.reduce(
    (sum, trace) => sum + trace.completion_tokens,
    0
  );
  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    averageLatencyMs: total > 0 ? Math.round(latency / total) : 0,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function filterTraces(
  traces: AnalyticsTrace[],
  filters: { agentId?: string; status?: string }
): AnalyticsTrace[] {
  return traces.filter((trace) => {
    if (filters.agentId && trace.agent_id !== filters.agentId) return false;
    if (filters.status && trace.status !== filters.status) return false;
    return true;
  });
}

/**
 * Count requests on each UTC day in the selected window.
 *
 * Days outside the window are ignored, so the chart matches the date filter.
 */
export function dailyActivity(
  traces: AnalyticsTrace[],
  days: number,
  now: Date
): DayBucket[] {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const buckets: DayBucket[] = [];
  for (let index = 0; index < days; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`,
      successful: 0,
      failed: 0,
    });
  }
  const indexByDay = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  for (const trace of traces) {
    const key = utcDayKey(trace.created_at);
    if (!key) continue;
    const index = indexByDay.get(key);
    if (index === undefined) continue;
    if (trace.status === "success") buckets[index].successful += 1;
    else buckets[index].failed += 1;
  }
  return buckets;
}

export function agentActivity(traces: AnalyticsTrace[]) {
  const groups = new Map<
    string,
    { id: string; name: string; requests: number; successful: number; latency: number }
  >();
  for (const trace of traces) {
    const current = groups.get(trace.agent_id) ?? {
      id: trace.agent_id,
      name: trace.agent_name?.trim() || "Unavailable",
      requests: 0,
      successful: 0,
      latency: 0,
    };
    current.requests += 1;
    current.latency += trace.latency_ms;
    if (trace.status === "success") current.successful += 1;
    if (trace.agent_name?.trim()) current.name = trace.agent_name.trim();
    groups.set(trace.agent_id, current);
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      successRate:
        group.requests > 0
          ? Math.round((group.successful / group.requests) * 100)
          : 0,
      averageLatencyMs: Math.round(group.latency / group.requests),
    }))
    .sort((left, right) => right.requests - left.requests);
}
