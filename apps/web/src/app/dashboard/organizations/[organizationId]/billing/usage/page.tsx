import { UsageTrend } from "@/components/billing/usage-trend";
import { billingUsage } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

const BAR_COLORS: Record<string, string> = {
  ai_requests: "#6042ef",
  workflow_executions: "#9055f5",
  knowledge_storage: "#4495b4",
  seats: "#cf7b08",
};

const styles = `
  .usage-card {
    width: 100%;
    max-width: 768px;
    margin: auto;
    padding: 15px 12px 12px;
    border: 1px solid #dedede;
    border-radius: 17px;
    background: #fff;
  }
  .usage-card .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .usage-card h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
  }
  .usage-card .subtitle {
    margin: 5px 0 0;
    color: #666;
    font-size: 12px;
    line-height: 17px;
  }
  .usage-card .period {
    padding: 3px 7px;
    border-radius: 999px;
    background: #ededed;
    font-size: 12px;
    font-weight: 600;
    line-height: 15px;
  }
  .usage-card .limits {
    margin-top: 15px;
  }
  .usage-card .limit + .limit {
    margin-top: 16px;
  }
  .usage-card .limit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .usage-card .limit-label {
    font-size: 14px;
    font-weight: 500;
    line-height: 19px;
  }
  .usage-card .limit-value {
    color: #666;
    font-size: 12px;
    line-height: 17px;
    white-space: nowrap;
  }
  .usage-card .divider {
    height: 1px;
    margin: 20px 0 23px;
    border: 0;
    background: #dedede;
  }
  .usage-card h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    line-height: 22px;
  }
  .usage-card .chart-wrap {
    position: relative;
    margin-top: 16px;
  }
  .usage-card .chart {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .usage-card .chart-note {
    margin: 18px 0 0;
    color: #888;
    font-size: 12px;
    line-height: 17px;
  }
  .usage-card .footer-note {
    margin: 19px 0 0;
    color: #707070;
    font-size: 14px;
    line-height: 19px;
  }
  .billing-progress {
    display: block;
    width: 100%;
    height: 9px;
    margin-top: 11px;
    overflow: hidden;
    appearance: none;
    border: 0;
    border-radius: 999px;
    background: #f1f1f1;
  }
  .billing-progress::-webkit-progress-bar {
    background: #f1f1f1;
    border-radius: 999px;
  }
  .billing-progress::-webkit-progress-value {
    background: var(--bar-color);
    border-radius: 999px;
  }
  .billing-progress::-moz-progress-bar {
    background: var(--bar-color);
    border-radius: 999px;
  }
  .billing-chart text {
    fill: #777;
    font-family: Arial, sans-serif;
    font-size: 12px;
  }
  .billing-grid line {
    stroke: #ebebeb;
    stroke-width: 1;
    stroke-dasharray: 2 4;
  }
  .billing-trend-line {
    fill: none;
    stroke: #6995ff;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .billing-trend-point {
    fill: #6995ff;
    stroke: #f0f4ff;
    stroke-width: 2;
    outline: none;
  }
  .billing-trend-point:focus,
  .billing-trend-point:hover {
    stroke: #cfddff;
    stroke-width: 4;
  }
  .billing-tooltip {
    position: absolute;
    z-index: 1;
    padding: 8px 10px;
    border: 1px solid #e5e5e5;
    border-radius: 7px;
    background: #fff;
    color: #333;
    font-size: 12px;
    box-shadow: 0 3px 12px rgb(0 0 0 / 10%);
    pointer-events: none;
    white-space: nowrap;
  }
  .billing-tooltip[hidden] {
    display: none;
  }
  @media (max-width: 480px) {
    .usage-card .limit-label {
      font-size: 12px;
    }
    .usage-card .limit-value {
      font-size: 11px;
    }
    .usage-card .footer-note {
      font-size: 12px;
    }
  }
`;

export default async function BillingUsagePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <main className="usage-card">
        <p className="m-0 text-[13px] text-[#666]">
          Choose an organization to view its usage.
        </p>
      </main>
    );
  }

  const usage = await billingUsage(org.id);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <main className="usage-card">
        <header className="header">
          <div>
            <h1>Usage &amp; Limits</h1>
            <p className="subtitle">Current billing period</p>
          </div>
          <span className="period">
            {usage?.interval === "yearly" ? "Yearly" : "Monthly"}
          </span>
        </header>

        <section className="limits" aria-label="Current usage limits">
          {(usage?.quotas ?? []).map((quota) => {
            const limit = quota.limit ?? 0;
            const ratio = quota.unlimited || limit <= 0 ? 0 : quota.used / limit;
            return (
              <div key={quota.key} className="limit">
                <div className="limit-header">
                  <span className="limit-label" id={`${quota.key}-label`}>
                    {quota.label}
                    {quota.unit === "MB" ? " (MB)" : ""}
                  </span>
                  <span className="limit-value">
                    {quota.unlimited
                      ? `${quota.used.toLocaleString("en-US")} / Unlimited`
                      : `${quota.used.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`}
                  </span>
                </div>
                <progress
                  className="billing-progress"
                  value={ratio}
                  max={1}
                  style={
                    {
                      "--bar-color": BAR_COLORS[quota.key] ?? "#6042ef",
                    } as React.CSSProperties
                  }
                  aria-labelledby={`${quota.key}-label`}
                >
                  {Math.round(ratio * 100)}%
                </progress>
              </div>
            );
          })}
        </section>

        <hr className="divider" />

        <section aria-labelledby="trend-title">
          <h2 id="trend-title">Usage Trend</h2>

          <UsageTrend trend={usage?.trend ?? []} />

          <p className="chart-note">
            Daily metered requests of the current billing period.
          </p>
        </section>

        <p className="footer-note">
          Quotas come from the plan of this workspace and are enforced by the
          API. Usage resets at the start of the next billing period.
        </p>
      </main>
    </>
  );
}
