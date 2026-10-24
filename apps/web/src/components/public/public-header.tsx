import Link from "next/link";

import { HomeNav } from "@/components/public/home-nav";

/**
 * The header shared by the public pages.
 */
export function PublicHeader() {
  return (
    <header className="nx-navbar">
      <Link href="/" className="nx-logo" aria-label="NEXORA home">
        <span className="nx-logo-mark">
          <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6" cy="5" r="2" />
            <circle cx="18" cy="5" r="2" />
            <circle cx="6" cy="19" r="2" />
            <circle cx="18" cy="19" r="2" />
            <path d="m7.5 6.5 9 11m0-11-9 11" />
          </svg>
        </span>
        <span>NEXORA</span>
      </Link>

      <HomeNav />

      <div className="nx-nav-actions">
        <Link href="/login" className="nx-button nx-button-login">
          Log In
        </Link>
        <Link href="/register" className="nx-button nx-button-primary">
          Get Started
        </Link>
      </div>
    </header>
  );
}
