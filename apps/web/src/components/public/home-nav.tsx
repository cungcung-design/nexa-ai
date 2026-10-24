"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/#product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Public section links. Below 700px the stylesheet hides the links until
 * the menu button adds `is-open`. Product stays on the homepage section.
 */
export function HomeNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const productRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function toggleMenu() {
    const next = !open;
    setOpen(next);
    if (next) {
      productRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nx-nav-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
      >
        {open ? "Close menu" : "Open menu"}
      </button>
      <nav
        id={menuId}
        className={open ? "nx-nav-links is-open" : "nx-nav-links"}
        aria-label="Main navigation"
      >
        {ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            ref={item.label === "Product" ? productRef : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
