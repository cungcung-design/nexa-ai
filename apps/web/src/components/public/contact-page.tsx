import Link from "next/link";

import { ContactSection } from "@/components/public/contact-section";

const CATEGORIES = [
  {
    title: "General inquiry",
    body: "Questions about the product that are not a support request or a pricing conversation.",
  },
  {
    title: "Sales and pricing",
    body: "Questions about the published plans, including the Enterprise plan, which is handled through contact rather than self-serve checkout.",
  },
  {
    title: "Request a demo",
    body: "Ask the team to walk through the workspace. This form does not schedule a meeting by itself.",
  },
  {
    title: "Technical support",
    body: "Help with an existing workspace, such as access, agents, or workflows.",
  },
  {
    title: "Partnerships",
    body: "Partnership questions use the same form. The message is stored with the partnership subject.",
  },
] as const;

/**
 * The public contact page.
 *
 * The form posts to the existing contact endpoint. A success message is the
 * message returned by that endpoint.
 */
export function ContactPage() {
  return (
    <>
      <header className="nx-page-hero">
        <p className="nx-page-kicker">CONTACT</p>
        <h1>Contact NEXORA</h1>
        <p>
          Send a message through the form. The site stores the message and
          shows the reply from the contact service. It does not show a success
          message before that reply arrives.
        </p>
      </header>

      <ContactSection />

      <section className="nx-page-block" aria-labelledby="channels-title">
        <h2 id="channels-title">Supported contact channels</h2>
        <p>
          The addresses below are the channels already published on the site:
          hello@nexora.ai, sales@nexora.ai, and support@nexora.ai. The office
          listed with them is Kuala Lumpur, Malaysia.
        </p>
      </section>

      <section className="nx-page-block" aria-labelledby="categories-title">
        <h2 id="categories-title">Common inquiry categories</h2>
        <div className="nx-page-grid">
          {CATEGORIES.map((category) => (
            <article key={category.title} className="nx-page-card">
              <h3>{category.title}</h3>
              <p>{category.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nx-page-block" aria-labelledby="contact-help-title">
        <h2 id="contact-help-title">Help</h2>
        <div className="nx-page-faq">
          <article className="nx-page-note">
            <h3>What happens after I send the form?</h3>
            <p>
              The contact service stores the message. If outbound email is
              configured, it can also forward the message. This environment
              does not treat a stored message as proof that an inbox received
              mail.
            </p>
          </article>
          <article className="nx-page-note">
            <h3>Where can I read the plans first?</h3>
            <p>
              <Link href="/pricing">Open the pricing page</Link> before asking
              about a plan.
            </p>
          </article>
          <article className="nx-page-note">
            <h3>I already have a workspace.</h3>
            <p>
              <Link href="/login">Sign in</Link> and use the workspace, or
              choose technical support in the form.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
