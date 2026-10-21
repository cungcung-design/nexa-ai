const QUESTIONS = [
  {
    question: "Do I need coding experience?",
    answer:
      "You can start with agent templates and supported workflow tools. Custom integrations may require development experience.",
  },
  {
    question: "What is NEXORA?",
    answer:
      "NEXORA brings agents, workflows, knowledge sources, and monitoring together in one workspace.",
  },
  {
    question: "Can I connect my own knowledge sources?",
    answer:
      "Connect supported documents and sources through your workspace's Knowledge Base.",
  },
];

/**
 * The questions of the public landing page.
 *
 * The answers open and close like the reference of the design.
 */
export function FaqSection() {
  return (
    <section id="faq" className="nx-faq" aria-labelledby="faq-title">
      <div className="nx-faq-grid">
        <h1 className="nx-faq-title" id="faq-title">
          Frequently asked questions
        </h1>

        {QUESTIONS.map((item) => (
          <details key={item.question} className="nx-faq-item">
            <summary className="nx-faq-question">{item.question}</summary>
            <p className="nx-faq-answer">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
