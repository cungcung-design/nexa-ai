import Link from "next/link";

const SAFEGUARDS = [
  {
    title: "Encryption everywhere",
    description:
      "Traffic is protected with TLS and every stored artifact is encrypted at rest.",
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Role based access",
    description:
      "Owners, admins, developers, and viewers see exactly what their role allows.",
    icon: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M6 21v-4a6 6 0 0 1 12 0v4M4 11h2m14 0h-2" />
      </>
    ),
  },
  {
    title: "Isolated workspaces",
    description:
      "Every organization is a separate tenant, no data ever crosses a workspace.",
    icon: (
      <>
        <path d="M12 3 4 7v5c0 5 8 9 8 9s8-4 8-9V7l-8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Audit logs",
    description:
      "Every change is recorded with the actor, the time, and the affected resource.",
    icon: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
  },
  {
    title: "Scoped API keys",
    description:
      "Keys belong to one workspace and carry the permissions of their owner.",
    icon: (
      <>
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9m-3 0v3m-3-3v2" />
      </>
    ),
  },
  {
    title: "Human approvals",
    description:
      "Sensitive actions wait for a reviewer before a workflow continues.",
    icon: (
      <>
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3l7 3v6c0 4.4-7 9-7 9s-7-4.6-7-9V6l7-3Z" />
      </>
    ),
  },
];

/**
 * The security section of the public landing page.
 *
 * The cards name the safeguards of the platform and lead to the workspace
 * settings where a team manages them.
 */
export function SecuritySection() {
  return (
    <section id="security" className="nx-security" aria-labelledby="security-title">
      <div className="nx-security-header">
        <h2 className="nx-security-title" id="security-title">
          Security
        </h2>
        <p className="nx-security-subtitle">
          Your workspace is protected by default, from the first request to the
          last audit entry.
        </p>
      </div>

      <div className="nx-security-grid">
        {SAFEGUARDS.map((safeguard) => (
          <article key={safeguard.title} className="nx-security-card">
            <span className="nx-security-icon">
              <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
                {safeguard.icon}
              </svg>
            </span>

            <h3 className="nx-security-card-title">{safeguard.title}</h3>
            <p className="nx-security-card-description">{safeguard.description}</p>
          </article>
        ))}
      </div>

      <div className="nx-security-actions">
        <Link href="/dashboard/settings" className="nx-button nx-button-primary">
          Review your settings →
        </Link>
        <Link href="#contact" className="nx-button">
          Talk to our team
        </Link>
      </div>
    </section>
  );
}
