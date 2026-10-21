import Link from "next/link";

const FOOTER_LINKS = [
  {
    label: "Contact",
    href: "/register",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
  },
  {
    label: "Community",
    href: "/login",
    icon: (
      <>
        <path d="M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4Z" />
        <path d="M8 11h8m-8 4h5" />
      </>
    ),
  },
  {
    label: "About NEXORA",
    href: "/terms",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10h.01" />
      </>
    ),
  },
];

/**
 * The call to action and the footer of the public landing page.
 *
 * The band closes the page with the registration and the links of the footer.
 */
export function CallToAction() {
  return (
    <section className="nx-cta" aria-labelledby="cta-title">
      <h2 className="nx-cta-title" id="cta-title">
        Ready to build with NEXORA?
      </h2>
      <p className="nx-cta-description">
        Turn your ideas into intelligent automation.
      </p>

      <footer className="nx-cta-footer">
        <Link href="/" className="nx-cta-logo" aria-label="NEXORA home">
          <span className="nx-cta-logo-mark">
            <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="5" r="2" />
              <circle cx="18" cy="5" r="2" />
              <circle cx="6" cy="19" r="2" />
              <circle cx="18" cy="19" r="2" />
              <path d="m7.5 6.5 9 11m0-11-9 11" />
            </svg>
          </span>
          NEXORA
        </Link>

        <Link href="/register" className="nx-cta-start">
          Get Started Free <span aria-hidden="true">→</span>
        </Link>

        <nav className="nx-cta-links" aria-label="Footer links">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="nx-cta-link"
              aria-label={link.label}
            >
              <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
                {link.icon}
              </svg>
            </Link>
          ))}
        </nav>
      </footer>
    </section>
  );
}
