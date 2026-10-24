import Link from "next/link";

const CAPABILITIES = [
  {
    title: "Workspace roles",
    body: "Members are owners, admins, developers, or viewers. Owners and admins invite people and manage API keys. Viewers cannot invite members or start a workflow.",
  },
  {
    title: "Organization isolation",
    body: "A request for an organization you do not belong to is refused. The workspace pages do not show another organization's agents, members, or keys.",
  },
  {
    title: "API keys",
    body: "A key is stored as a SHA-256 hash. The full secret is shown once, later lists show a masked prefix, and a key can expire or be revoked. Scopes are agent invoke and agent read.",
  },
  {
    title: "Sessions",
    body: "Signing in sets an HTTP-only session cookie. Changing workspace data through the site is checked as a same-origin request. Email verification is required before onboarding.",
  },
] as const;

/**
 * The public security page.
 */
export function SecurityPage() {
  return (
    <>
      <header className="nx-page-hero">
        <p className="nx-page-kicker">SECURITY</p>
        <h1>Controls that are part of NEXORA</h1>
        <p>
          This page describes access controls, approvals, and audit records
          that the product implements. It does not describe a certification or
          an encryption guarantee.
        </p>
      </header>

      <section className="nx-page-block" aria-labelledby="capabilities-title">
        <h2 id="capabilities-title">Security Capabilities</h2>
        <div className="nx-page-grid">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="nx-page-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nx-page-block" aria-labelledby="principles-title">
        <h2 id="principles-title">Security Principles</h2>
        <ul className="nx-page-list">
          <li className="nx-page-note">
            <p>
              Least privilege: a viewer can read the workspace, while member
              management and billing changes stay with owners and admins.
            </p>
          </li>
          <li className="nx-page-note">
            <p>
              Workspace boundaries: data and API calls are resolved through a
              membership. A missing membership does not reveal the organization.
            </p>
          </li>
          <li className="nx-page-note">
            <p>
              Secrets stay short-lived on screen: an API key secret is returned
              once at creation and is not stored in a form that the list can
              show again.
            </p>
          </li>
        </ul>
      </section>

      <section className="nx-page-block" aria-labelledby="human-title">
        <h2 id="human-title">Human-in-the-Loop</h2>
        <p>
          A workflow can pause before it continues. Owners and admins approve
          or reject that run. The decision uses the original run, and a
          repeated decision is refused. Developers can start a run. Viewers
          cannot.
        </p>
        <p className="nx-page-actions">
          <Link href="/features">Feature details</Link>
        </p>
      </section>

      <section className="nx-page-block" aria-labelledby="audit-title">
        <h2 id="audit-title">Audit Logs and Monitoring</h2>
        <p>
          The workspace records audit events for sign-in, invitations, API key
          changes, and member role changes. Secret values are redacted in those
          records. Workflow executions keep their status, and AI requests can
          be stored as traces.
        </p>
      </section>

      <section className="nx-page-block" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Data and Privacy</h2>
        <p>
          Account, workspace, contact, and product records are stored by the
          application. The public privacy page explains how that information is
          handled. This page does not describe a certification.
        </p>
        <p className="nx-page-actions">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </p>
      </section>

      <section className="nx-page-block" aria-labelledby="security-faq-title">
        <h2 id="security-faq-title">Security FAQ</h2>
        <div className="nx-page-faq">
          <article className="nx-page-note">
            <h3>Who can invite a teammate?</h3>
            <p>Owners and admins. A developer or viewer cannot send an invitation.</p>
          </article>
          <article className="nx-page-note">
            <h3>Can a revoked API key still call an agent?</h3>
            <p>No. A revoked or expired key is rejected.</p>
          </article>
          <article className="nx-page-note">
            <h3>Is NEXORA certified?</h3>
            <p>
              No certification is claimed here. Ask about your requirements
              through the contact page.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
