import Link from "next/link";

import { CallToAction } from "@/components/public/call-to-action";
import { ContactSection } from "@/components/public/contact-section";
import { FaqSection } from "@/components/public/faq-section";
import { FeaturesSection } from "@/components/public/features-section";
import { PricingSection } from "@/components/public/pricing-section";
import { PublicHeader } from "@/components/public/public-header";
import { SecuritySection } from "@/components/public/security-section";
import { SolutionsSection } from "@/components/public/solutions-section";

const DASHBOARD_LINKS: [string, string, boolean][] = [
  ["▣", "Dashboard", true],
  ["♧", "AI Agents", false],
  ["⌘", "Workflows", false],
  ["▤", "Knowledge Base", false],
  ["◈", "Integrations", false],
  ["▢", "Conversations", false],
  ["◇", "Approvals", false],
  ["▥", "Analytics", false],
  ["▧", "Audit Logs", false],
  ["♧", "Team", false],
  ["▱", "Billing", false],
  ["⚙", "Settings", false],
];

const DASHBOARD_ACTIVITY = [
  ["✦", "Agent execution", "Workflow completed"],
  ["◇", "Task completed", "Agent response received"],
  ["▣", "Data fetching", "Knowledge source updated"],
  ["◈", "Data handling", "Processing finished"],
];

const AGENTS = [
  "Support Agent",
  "Research Agent",
  "Workflow Agent",
  "Sales Assistant",
  "Knowledge Agent",
  "Operations Agent",
  "Data Assistant",
];

const SHORTCUTS = [
  {
    title: "AI Agents",
    subtitle: "Build and deploy",
    icon: (
      <>
        <circle cx="12" cy="6" r="3" />
        <circle cx="5" cy="10" r="2" />
        <circle cx="19" cy="10" r="2" />
        <path d="M7 21v-4a5 5 0 0 1 10 0v4H7ZM2 20v-4a3 3 0 0 1 4-2.8M22 20v-4a3 3 0 0 0-4-2.8" />
      </>
    ),
  },
  {
    title: "Workflows",
    subtitle: "Automate processes",
    icon: (
      <>
        <rect x="9" y="2" width="6" height="6" rx="1" />
        <rect x="2" y="16" width="6" height="6" rx="1" />
        <rect x="16" y="16" width="6" height="6" rx="1" />
        <path d="M12 8v4H5v4m7-4h7v4" />
      </>
    ),
  },
  {
    title: "Knowledge Base",
    subtitle: "Connect your data",
    icon: (
      <>
        <path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16" />
        <path d="M6 7h3M6 11h3m6-4h3m-3 4h3" />
      </>
    ),
  },
  {
    title: "Integrations",
    subtitle: "Your favorite tools",
    icon: <path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v4" />,
  },
];

/**
 * The public landing page.
 *
 * It introduces the product and leads to the sign in and to the registration.
 * Everything the signed in user needs lives in the dashboard.
 */
export function PublicHomePage() {
  return (
    <div className="nx-homepage">
      <div className="nx-container">
        <PublicHeader />

        <main>
          <section className="nx-hero" aria-labelledby="hero-title">
            <div className="nx-hero-content">
              <div className="nx-badge">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
                </svg>
                AI-Powered Automation Platform
              </div>

              <h1 id="hero-title">
                Build intelligent
                <br />
                AI agents.
              </h1>
              <p className="nx-tagline">Automate your workflows.</p>

              <p className="nx-hero-description">
                Create, connect, deploy, and monitor AI-powered automations from
                one unified workspace.
              </p>

              <div className="nx-hero-actions">
                <Link href="/register" className="nx-button nx-button-primary">
                  Get Started Free →
                </Link>
                <a href="#demo" className="nx-button">
                  Watch Demo
                </a>
              </div>
            </div>

            <div
              className="nx-preview"
              id="demo"
              role="img"
              aria-label="Illustrative NEXORA Dashboard with agent metrics, recent activity, and a usage chart"
            >
              <div className="nx-dashboard" aria-hidden="true">
                <div className="nx-icon-rail">
                  <span className="nx-rail-logo">✣</span>
                  <span>▣</span>
                  <span>◇</span>
                  <span>⌘</span>
                  <span>▤</span>
                  <span>◈</span>
                  <span>♧</span>
                  <span>◎</span>
                  <span>⚙</span>
                </div>

                <aside className="nx-dash-sidebar">
                  <div className="nx-dash-brand">✣ NEXORA</div>
                  {DASHBOARD_LINKS.map(([symbol, label, active]) => (
                    <div
                      key={label}
                      className={`nx-dash-link ${active ? "nx-dash-link-active" : ""}`}
                    >
                      {symbol} &nbsp;{label}
                    </div>
                  ))}
                </aside>

                <div className="nx-dash-main">
                  <div className="nx-dash-toolbar">
                    <div className="nx-search">⌕ &nbsp; Search workspace...</div>
                    <span className="nx-create">＋ Create Agent</span>
                  </div>

                  <h2 className="nx-dash-title">Workspace Overview</h2>

                  <div className="nx-stats">
                    <div className="nx-stat">
                      <small>Total Agents</small>
                      <strong>
                        12 <em>+20%</em>
                      </strong>
                    </div>
                    <div className="nx-stat">
                      <small>Workflow Runs</small>
                      <strong>
                        892 <em>+12%</em>
                      </strong>
                    </div>
                    <div className="nx-stat">
                      <small>Approval Requests</small>
                      <strong>5</strong>
                    </div>
                  </div>

                  <div className="nx-dash-columns">
                    <div className="nx-dash-card">
                      <h3>Recent Activity</h3>

                      {DASHBOARD_ACTIVITY.map(([symbol, title, subtitle]) => (
                        <div key={title} className="nx-activity">
                          <span className="nx-activity-icon">{symbol}</span>
                          <div>
                            <b>{title}</b>
                            <small>{subtitle}</small>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="nx-dash-card">
                      <h3>Usage Overview</h3>
                      <svg
                        className="nx-usage-chart"
                        viewBox="0 0 220 150"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#8464ff" stopOpacity=".85" />
                            <stop offset="1" stopColor="#8464ff" stopOpacity=".06" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0 25H220M0 60H220M0 95H220M0 130H220"
                          fill="none"
                          stroke="#f0eef9"
                        />
                        <path
                          d="M0 112C14 111 20 71 38 76S64 109 82 94 S105 42 124 52S147 90 163 63 S184 20 198 27S210 48 220 39V150H0Z"
                          fill="url(#chartFill)"
                        />
                        <path
                          d="M0 112C14 111 20 71 38 76S64 109 82 94 S105 42 124 52S147 90 163 63 S184 20 198 27S210 48 220 39"
                          fill="none"
                          stroke="#7650ff"
                          strokeWidth="2"
                        />
                      </svg>
                      <div className="nx-chart-labels">
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="nx-dash-right">
                  <h4>Active Agents</h4>
                  {AGENTS.map((agent) => (
                    <div key={agent} className="nx-agent-row">
                      <span className="nx-agent-dot" />
                      <span>{agent}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="nx-product" id="product" aria-labelledby="product-title">
            <div className="nx-section-header">
              <h2 className="nx-section-title" id="product-title">
                Product
              </h2>
            </div>
            <div className="nx-shortcuts">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.title} className="nx-shortcut">
                  <span className="nx-shortcut-icon">
                    <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
                      {shortcut.icon}
                    </svg>
                  </span>
                  <div>
                    <h2>{shortcut.title}</h2>
                    <p>{shortcut.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <FeaturesSection />

          <SolutionsSection />

          <PricingSection />

          <FaqSection />

          <SecuritySection />

          <ContactSection />

          <CallToAction />
        </main>
      </div>
    </div>
  );
}
