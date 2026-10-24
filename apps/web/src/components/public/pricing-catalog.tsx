import Link from "next/link";

export type PublicPlanPrice = {
  amount: number;
  currency: string;
  interval: string;
  monthly_equivalent: number;
  annual_total: number;
};

export type PublicPlan = {
  key: string;
  label: string;
  tagline: string;
  features: string[];
  limits: {
    agents: number;
    monthly_requests: number;
    knowledge_bases: number;
    workflow_executions: number;
    storage_mb: number;
    seats: number;
  };
  monthly: PublicPlanPrice | null;
  yearly: PublicPlanPrice | null;
  contact_sales: boolean;
  popular: boolean;
  purchasable: boolean;
};

const LIMIT_ROWS = [
  { key: "agents", label: "Agents" },
  { key: "monthly_requests", label: "Monthly AI requests" },
  { key: "knowledge_bases", label: "Knowledge bases" },
  { key: "workflow_executions", label: "Workflow executions" },
  { key: "storage_mb", label: "Storage (MB)" },
  { key: "seats", label: "Seats" },
] as const;

/**
 * Format a catalog amount in cents as dollars.
 */
export function formatCatalogAmount(amount: number): string {
  if (amount % 100 === 0) return `$${amount / 100}`;
  return `$${(amount / 100).toFixed(2)}`;
}

function planPrice(plan: PublicPlan): string {
  if (plan.contact_sales || plan.monthly == null) return "Custom";
  return formatCatalogAmount(plan.monthly.amount);
}

function planHref(plan: PublicPlan): string {
  if (plan.contact_sales) return "/contact";
  return `/register?plan=${plan.label.toLowerCase()}`;
}

function planAction(plan: PublicPlan): string {
  if (plan.contact_sales) return "Contact sales";
  if (plan.monthly?.amount === 0) return "Get started";
  return plan.purchasable ? "Choose plan" : "Sign up";
}

/**
 * Pricing content rendered from the public billing catalog.
 */
export function PricingCatalog({
  plans,
  unavailable,
}: {
  plans: PublicPlan[] | null;
  unavailable: boolean;
}) {
  return (
    <>
      <header className="nx-page-hero">
        <p className="nx-page-kicker">PRICING</p>
        <h1>Plans from the billing catalog</h1>
        <p>
          Prices, features, and limits on this page come from the configured
          subscription catalog. They are not entered separately for the
          website.
        </p>
      </header>

      {unavailable || plans == null ? (
        <section className="nx-catalog-error" aria-labelledby="catalog-error">
          <h2 id="catalog-error">The pricing catalog could not be loaded</h2>
          <p>
            The public plan service did not return the catalog, so this page
            is not showing prices. Try again when the service is available, or
            ask through the contact page.
          </p>
          <p className="nx-page-actions">
            <Link href="/contact">Contact</Link>
          </p>
        </section>
      ) : (
        <>
          <section className="nx-page-block" aria-labelledby="plans-title">
            <h2 id="plans-title">Subscription plans</h2>
            <div className="nx-page-grid">
              {plans.map((plan) => (
                <article key={plan.key} className="nx-page-card">
                  <h3>{plan.label}</h3>
                  <p className="nx-price">{planPrice(plan)}</p>
                  <p>{plan.tagline}</p>
                  {plan.yearly ? (
                    <p>
                      {formatCatalogAmount(plan.yearly.amount)} billed yearly
                    </p>
                  ) : null}
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  {!plan.contact_sales && plan.monthly && plan.monthly.amount > 0 && !plan.purchasable ? (
                    <p>Online checkout is not configured for this plan.</p>
                  ) : null}
                  <p className="nx-page-actions">
                    <Link href={planHref(plan)}>{planAction(plan)}</Link>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="nx-page-block" aria-labelledby="limits-title">
            <h2 id="limits-title">Supported plan features and limits</h2>
            <div className="nx-page-grid">
              {plans.map((plan) => (
                <article key={`${plan.key}-limits`} className="nx-page-card">
                  <h3>{plan.label}</h3>
                  <ul>
                    <li>
                      {plan.limits.agents} {plan.limits.agents === 1 ? "agent" : "agents"}
                    </li>
                    <li>{plan.limits.monthly_requests.toLocaleString("en-US")} monthly AI requests</li>
                    <li>
                      {plan.limits.knowledge_bases}{" "}
                      {plan.limits.knowledge_bases === 1 ? "knowledge base" : "knowledge bases"}
                    </li>
                    <li>
                      {plan.limits.workflow_executions.toLocaleString("en-US")} workflow executions
                    </li>
                    <li>{plan.limits.storage_mb.toLocaleString("en-US")} MB storage</li>
                    <li>{plan.limits.seats} {plan.limits.seats === 1 ? "seat" : "seats"}</li>
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="nx-page-block" aria-labelledby="comparison-title">
            <h2 id="comparison-title">Comparison</h2>
            <table className="nx-compare">
              <caption>Plan limits from the billing catalog</caption>
              <thead>
                <tr>
                  <th scope="col">Limit</th>
                  {plans.map((plan) => (
                    <th key={plan.key} scope="col">
                      {plan.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIMIT_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {plans.map((plan) => (
                      <td key={`${plan.key}-${row.key}`}>
                        {plan.limits[row.key].toLocaleString("en-US")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="nx-page-block" aria-labelledby="pricing-faq-title">
            <h2 id="pricing-faq-title">FAQ</h2>
            <div className="nx-page-faq">
              <article className="nx-page-note">
                <h3>Which plan is free?</h3>
                <p>
                  {plans
                    .filter((plan) => plan.monthly?.amount === 0)
                    .map((plan) => `${plan.label} is ${planPrice(plan)}.`)
                    .join(" ") || "No free plan is configured."}
                </p>
              </article>
              <article className="nx-page-note">
                <h3>Can I buy a paid plan online?</h3>
                <p>
                  {plans.some((plan) => plan.purchasable)
                    ? "A plan marked as purchasable can be bought after you sign in, when checkout is available for that price."
                    : "None of the current paid plans have online checkout configured. You can still create an account, and Enterprise is handled through contact."}
                </p>
              </article>
              <article className="nx-page-note">
                <h3>How do I ask about Enterprise?</h3>
                <p>
                  {plans
                    .filter((plan) => plan.contact_sales)
                    .map((plan) => plan.label)
                    .join(", ") || "Enterprise"}{" "}
                  does not have a self-serve price. Use the contact page.
                </p>
              </article>
            </div>
          </section>
        </>
      )}
    </>
  );
}
