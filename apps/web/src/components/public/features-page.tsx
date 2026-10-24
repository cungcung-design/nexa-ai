import Link from "next/link";

const SECTIONS = [
  {
    id: "ai-agents",
    title: "AI Agents",
    body: "A workspace can create an agent, keep versions, publish one version, and try it in the playground. A published version is what the playground and an API key can call.",
    links: [
      { href: "/register", label: "Create a workspace" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    id: "workflows",
    title: "Workflows",
    body: "The workspace lists workflow definitions and executions. The included definition pauses for a human decision before it writes a note. Starting a workflow is limited to owners, admins, and developers.",
    links: [{ href: "/solutions", label: "See workflow use cases" }],
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    body: "A workspace can store documents in a knowledge base and search them. Plan limits decide how many knowledge bases the workspace can keep.",
    links: [{ href: "/pricing", label: "See knowledge-base limits" }],
  },
  {
    id: "integrations",
    title: "Integrations",
    body: "The workspace includes pages for connections, webhooks, and a marketplace. A connection stays inside the organization that created it.",
    links: [{ href: "/security", label: "How workspace access works" }],
  },
  {
    id: "human-approvals",
    title: "Human Approvals",
    body: "When a workflow is waiting for approval, an owner or admin can approve or reject it. A viewer cannot make that decision. Approving resumes the same workflow run.",
    links: [{ href: "/security", label: "Human-in-the-loop controls" }],
  },
  {
    id: "analytics",
    title: "Analytics and Monitoring",
    body: "AI requests can be recorded as traces, and workflow runs keep a status such as waiting for approval, running, completed, rejected, or failed. This page does not add a separate analytics product.",
    links: [{ href: "/login", label: "Open your workspace" }],
  },
  {
    id: "security-control",
    title: "Security and Control",
    body: "Owners and admins manage members and API keys. Keys are stored as a hash, shown in full once, and can be revoked. Each key can be limited to agent invoke or agent read.",
    links: [{ href: "/security", label: "Read the security page" }],
  },
] as const;

/**
 * The public features page.
 */
export function FeaturesPage() {
  return (
    <>
      <header className="nx-page-hero">
        <p className="nx-page-kicker">FEATURES</p>
        <h1>What a NEXORA workspace includes</h1>
        <p>
          These are the product areas available after you sign in. Each one
          stays inside the organization you belong to.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="nx-page-block"
          aria-labelledby={`${section.id}-title`}
        >
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          <p>{section.body}</p>
          <p className="nx-page-actions">
            {section.links.map((link) => (
              <Link key={link.href + link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
          </p>
        </section>
      ))}
    </>
  );
}
