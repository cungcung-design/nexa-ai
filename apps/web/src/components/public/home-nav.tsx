"use client";

import type { MouseEvent } from "react";

const ITEMS = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "solutions", label: "Solutions" },
  { id: "pricing", label: "Pricing" },
  { id: "security", label: "Security" },
  { id: "contact", label: "Contact" },
] as const;

/**
 * The section links of the public landing page.
 *
 * Each item scrolls to the section whose heading uses the same label.
 */
export function HomeNav() {
  function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    const nextHash = `#${id}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }

  return (
    <nav className="nx-nav-links" aria-label="Main navigation">
      {ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(event) => scrollToSection(event, item.id)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
