import Link from "next/link";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    description: "Get started and explore NEXORA.",
    features: ["Basic agents", "Limited usage", "Community support"],
    action: "Get Started",
    href: "/register?plan=free",
    outline: false,
  },
  {
    name: "Starter",
    price: "$19",
    description: "per month",
    features: ["More agents", "Standard usage", "Email support"],
    action: "Select Plan",
    href: "/register?plan=starter",
    outline: false,
  },
  {
    name: "Pro",
    price: "$49",
    description: "per month",
    features: ["Advanced features", "Higher usage", "Priority support"],
    action: "Select Plan",
    href: "/register?plan=pro",
    outline: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations with advanced needs.",
    features: ["Custom limits", "Dedicated support", "Security controls"],
    action: "Contact Sales",
    href: "/register?plan=enterprise",
    outline: true,
  },
];

/**
 * The pricing table of the public landing page.
 *
 * Every plan lists what it includes and leads to the registration with the
 * chosen plan.
 */
export function PricingSection() {
  return (
    <section id="pricing" className="nx-pricing" aria-labelledby="pricing-title">
      <div className="nx-section-header">
        <h2 className="nx-section-title" id="pricing-title">
          Pricing
        </h2>
      </div>
      {PLANS.map((plan) => (
        <article key={plan.name} className="nx-plan">
          <h2 className="nx-plan-name">{plan.name}</h2>
          <p
            className={`nx-price${plan.price === "Custom" ? " nx-price-custom" : ""}`}
          >
            {plan.price}
          </p>
          <p className="nx-plan-description">{plan.description}</p>

          <ul className="nx-plan-features">
            {plan.features.map((feature) => (
              <li key={feature} className="nx-plan-feature">
                <svg
                  className="nx-check"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="m3 8 3 3 7-7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href={plan.href}
            className={`nx-plan-button${plan.outline ? " nx-plan-button-outline" : ""}`}
          >
            {plan.action}
          </Link>
        </article>
      ))}
    </section>
  );
}
