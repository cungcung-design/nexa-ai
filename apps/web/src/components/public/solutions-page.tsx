import Link from "next/link";

const USES = [
  {
    id: "customer-support",
    title: "Customer Support",
    body: "A support team can publish an agent and give it documents from a knowledge base. The agent answers from that workspace. A workflow can still pause so an owner or admin reviews a step before it continues.",
  },
  {
    id: "operations-automation",
    title: "Operations Automation",
    body: "Operators can start a workflow definition and follow its execution status. The included definition waits for approval before it writes a note. There is not a separate catalog of industry workflows.",
  },
  {
    id: "knowledge-assistance",
    title: "Knowledge Assistance",
    body: "Teams can add documents to a knowledge base and search them from the workspace. The number of knowledge bases follows the plan limits on the pricing page.",
  },
  {
    id: "ai-workflow-automation",
    title: "AI Workflow Automation",
    body: "Owners, admins, and developers can start a workflow. Viewers can look at the workspace but cannot start a run or decide an approval. Approving or rejecting resumes or stops that same run.",
  },
] as const;

/**
 * The public solutions page.
 */
export function SolutionsPage() {
  return (
    <>
      <header className="nx-page-hero">
        <p className="nx-page-kicker">SOLUTIONS</p>
        <h1>Ways teams use a NEXORA workspace</h1>
        <p>
          These explanations describe the product that exists today: agents,
          knowledge bases, and workflows that can wait for a person.
        </p>
      </header>
      {USES.map((use) => (
        <section
          key={use.id}
          id={use.id}
          className="nx-page-block"
          aria-labelledby={`${use.id}-title`}
        >
          <h2 id={`${use.id}-title`}>{use.title}</h2>
          <p>{use.body}</p>
        </section>
      ))}
      <section className="nx-page-block" aria-labelledby="use-cases-title">
        <h2 id="use-cases-title">Use-case explanations</h2>
        <div className="nx-page-grid">
          <article className="nx-page-card">
            <h3>Answer from your documents</h3>
            <p>
              Publish an agent, attach workspace knowledge, and try the reply
              in the playground before anyone else uses it.
            </p>
          </article>
          <article className="nx-page-card">
            <h3>Pause before a change</h3>
            <p>
              The included workflow stops for approval. An owner or admin
              approves or rejects it, and a second decision on the same run is
              rejected.
            </p>
          </article>
          <article className="nx-page-card">
            <h3>Keep work in one organization</h3>
            <p>
              Agents, documents, workflows, and API keys belong to one
              organization. A person who is not a member cannot open that
              workspace.
            </p>
          </article>
          <article className="nx-page-card">
            <h3>Choose a plan that matches the limits</h3>
            <p>
              Agent, request, knowledge-base, workflow, storage, and seat
              limits come from the billing catalog.
            </p>
            <p>
              <Link href="/pricing">Compare plans</Link>
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
