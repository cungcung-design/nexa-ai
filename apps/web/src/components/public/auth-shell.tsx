import type { ReactNode } from "react";

import {
  BrainIcon,
  BriefcaseIcon,
  BuildingIcon,
  CloudIcon,
  BotIcon,
  HeadsetIcon,
  WorkflowIcon,
} from "@/components/public/auth-icons";

/**
 * The brand panel of the authentication pages.
 *
 * The floating glyphs change between the two pages exactly like the design:
 * the sign in page shows the product artwork while the sign up page shows the
 * company artwork.
 */
export function AuthVisual({ variant }: { variant: "login" | "register" }) {
  const icons =
    variant === "register"
      ? [BriefcaseIcon, BuildingIcon, CloudIcon, BrainIcon]
      : [BrainIcon, WorkflowIcon, BotIcon, HeadsetIcon];

  return (
    <aside className="nx-auth-visual" aria-label="Nexa AI">
      <div className="nx-auth-ribbon nx-auth-ribbon-one" />
      <div className="nx-auth-ribbon nx-auth-ribbon-two" />
      <div className="nx-auth-ribbon nx-auth-ribbon-three" />

      <div className="nx-auth-brand-copy">
        <h2>Nexa AI</h2>
        <p>Build. Automate. Grow.</p>
      </div>

      {icons.map((Icon, index) => (
        <div
          key={index}
          className={`nx-auth-float nx-auth-float-${["one", "two", "three", "four"][index]}`}
        >
          <Icon className="nx-auth-icon" />
        </div>
      ))}
    </aside>
  );
}

/**
 * The card that holds the authentication form and the brand panel.
 */
export function AuthShell({
  brandIcon,
  title,
  description,
  variant,
  children,
}: {
  brandIcon: ReactNode;
  title: string;
  description: string;
  variant: "login" | "register";
  children: ReactNode;
}) {
  return (
    <main className="nx-auth-page">
      <div className="nx-auth-card">
        <section className="nx-auth-form-panel">
          <div className="nx-auth-form-content">
            <div className="nx-auth-brand-icon">{brandIcon}</div>
            <h1 className="nx-auth-title">{title}</h1>
            <p className="nx-auth-subtitle">{description}</p>
            {children}
          </div>
        </section>

        <AuthVisual variant={variant} />
      </div>
    </main>
  );
}
