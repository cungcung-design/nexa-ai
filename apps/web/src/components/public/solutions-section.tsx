import Link from "next/link";

const QUESTIONS = [
  {
    question: "Can NEXORA be used for my industry?",
    answer:
      "NEXORA can support different use cases through configurable agents, workflows, and knowledge sources. Talk to our team about your industry's requirements.",
  },
  {
    question: "Do I need technical expertise to get started?",
    answer:
      "Start with available templates and guided setup. Custom integrations and advanced workflows may require development experience.",
  },
  {
    question: "Can I connect my own data sources?",
    answer:
      "Connect supported documents and data sources through your workspace's Knowledge Base and Integrations.",
  },
  {
    question: "How do human approvals work in solution workflows?",
    answer:
      "Actions configured to require approval pause for an authorized reviewer. Execution continues only after approval, according to the workflow's policy.",
  },
];

const SIDEBAR_LINKS = [
  "Dashboard",
  "AI Agents",
  "Workflows",
  "Knowledge Base",
  "Integrations",
  "Conversations",
  "Approvals",
  "Analytics",
  "Settings",
];

/**
 * The solutions section of the public landing page.
 *
 * It shows what a personalized demo looks like and answers the questions
 * about the use cases of the platform.
 */
export function SolutionsSection() {
  return (
    <section id="solutions" className="nx-solutions" aria-labelledby="solutions-heading">
      <div className="nx-section-header">
        <h2 className="nx-section-title" id="solutions-heading">
          Solutions
        </h2>
      </div>
      <div className="nx-solutions-banner">
        <div className="nx-solutions-copy">
          <h1 className="nx-solutions-title" id="solutions-title">
            See solutions in action
          </h1>

          <p className="nx-solutions-description">
            Explore how NEXORA can be applied to your specific use case with a
            personalized demo.
          </p>

          <div className="nx-solutions-actions">
            <Link
              href="/register"
              className="nx-solutions-button nx-solutions-button-primary"
            >
              Get Started Free <span aria-hidden="true">→</span>
            </Link>
            <Link href="#contact" className="nx-solutions-button">
              Talk to Sales
            </Link>
          </div>
        </div>

        <div className="nx-solutions-preview" aria-hidden="true">
          <div className="nx-solutions-back" />

          <div className="nx-solutions-dashboard">
            <div className="nx-solutions-rail">
              <span>✣</span>
              <span>▣</span>
              <span>◇</span>
              <span>⌘</span>
              <span>▤</span>
              <span>◎</span>
              <span>⚙</span>
            </div>

            <div className="nx-solutions-sidebar">
              <div className="nx-solutions-mini-logo">✣ NEXORA</div>
              {SIDEBAR_LINKS.map((link, index) => (
                <div
                  key={link}
                  className={`nx-solutions-mini-link${
                    index === 0 ? " nx-solutions-mini-link-active" : ""
                  }`}
                >
                  {link}
                </div>
              ))}
            </div>

            <div className="nx-solutions-main">
              <div className="nx-solutions-toolbar">
                <div className="nx-solutions-search" />
                <span className="nx-solutions-create">＋ Create Agent</span>
              </div>

              <h2 className="nx-solutions-heading">Workspace Overview</h2>

              <div className="nx-solutions-stats">
                <div className="nx-solutions-stat">
                  <small>Total Agents</small>
                  <strong>12</strong>
                </div>
                <div className="nx-solutions-stat">
                  <small>Workflow Runs</small>
                  <strong>892</strong>
                </div>
                <div className="nx-solutions-stat">
                  <small>Approvals</small>
                  <strong>5</strong>
                </div>
              </div>

              <div className="nx-solutions-panels">
                <div className="nx-solutions-card">
                  <h3>Recent Activity</h3>
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="nx-solutions-activity">
                      <i />
                      <span />
                    </div>
                  ))}
                </div>

                <div className="nx-solutions-card">
                  <h3>Usage Overview</h3>

                  <svg
                    className="nx-solutions-chart"
                    viewBox="0 0 150 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient
                        id="solutionsChartFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0" stopColor="#966eff" stopOpacity=".9" />
                        <stop offset="1" stopColor="#966eff" stopOpacity=".08" />
                      </linearGradient>
                    </defs>

                    <path
                      d="M0 20h150M0 45h150M0 70h150"
                      stroke="#f0ebf9"
                      fill="none"
                    />
                    <path
                      d="M0 80C10 78 15 43 29 48S45 73 58 59 S76 25 88 33S103 60 115 38S137 21 150 32V100H0Z"
                      fill="url(#solutionsChartFill)"
                    />
                    <path
                      d="M0 80C10 78 15 43 29 48S45 73 58 59 S76 25 88 33S103 60 115 38S137 21 150 32"
                      stroke="#8a5cff"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="nx-solutions-faq">
        <h2 className="nx-solutions-faq-title">
          Common questions about our solutions
        </h2>

        <div className="nx-solutions-questions">
          {QUESTIONS.map((item) => (
            <details key={item.question} className="nx-solutions-question">
              <summary>
                <span className="nx-solutions-question-icon" aria-hidden="true">
                  +
                </span>
                {item.question}
              </summary>
              <p className="nx-solutions-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
