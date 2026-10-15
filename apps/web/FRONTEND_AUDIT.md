# Nexa AI frontend audit

## Scope reviewed

The `src/app` and `src/components` trees, shared API/workspace helpers, frontend
tests, and npm scripts were inspected before redesign work.

## Existing routes and behavior

- Authentication: `/login`, `/register`; both use `LoginForm` and the existing
  auth proxy. The root route redirects to `/dashboard`.
- Dashboard: `/dashboard` lists organizations and creates workspaces.
  Organization-scoped routes cover overview, agents and agent details, the
  playground, conversations, knowledge bases, workflows, approvals,
  deployments, analytics, billing, and settings.
- Legacy dashboard routes remain present and redirect to an organization
  section through `org-redirect`.
- API routes proxy authentication and organization-scoped operations. Feature
  managers already use those APIs for agent chat/versioning, conversations,
  knowledge, approvals, billing, and deployments. Analytics intentionally
  shows unavailable states for metrics the backend does not supply.
- The dashboard layout fetches the current user and organizations without
  caching; organization routes verify membership. Workspace switching rewrites
  the scoped URL. These boundaries must remain intact.
- Existing dependencies include Next.js, React, Tailwind, Lucide, Vitest, and
  Playwright. Scripts include `typecheck`, `build`, `lint`, `test`,
  `test:e2e`, `verify:files`, and `verify:api`.

## Findings

- Global styles force a dark color scheme and hard-code page background and
  foreground colors. There is no shared semantic theme preference.
- The shell has functional organization switching, collapsible desktop
  navigation, and a mobile drawer, but navigation entries use inconsistent
  route patterns and the header repeats organization context without a
  breadcrumb hierarchy.
- Most pages use locally repeated headings, card treatments, border colors,
  and spacing. The visual system is therefore inconsistent and expensive to
  refine across routes.
- Auth forms have required fields and server/network error display, but no
  password visibility control or dedicated recovery route. Labels, focus
  treatment, and control sizing are inconsistent. The inspected API route set
  has no password reset endpoint.
- Feature pages are generally responsive through Tailwind breakpoints, but
  dense tables/configuration areas and long values need overflow safeguards.
- Dialogs are implemented in feature components without a shared dialog
  primitive or explicit focus handling. Empty/unavailable states exist on
  several data-driven screens and should not be replaced with fabricated data.
- Navigation is split between legacy redirects and organization-scoped links;
  route patterns need testing before navigation changes. Evaluations has a
  working organization-query route but was not linked from the workspace
  sidebar.
- No Figma integration was available in the inspected project; the design
  system will be documented in source CSS and implemented directly.

## Design implementation direction

Implemented semantic CSS variables for light and dark surfaces, text, borders,
brand and status colors; standardized shell dimensions, page framing, controls,
focus visibility, and responsive spacing. Shared navigation now includes an
organization-linked evaluations entry and a persistent theme switch.
Authentication now uses the existing same-origin login/register/logout proxy
handlers, and exposes password visibility. Password recovery explains that
the missing service endpoint is not configured rather than pretending to
submit a reset request. Agent search/filter and evaluation result states were
added without changing backend contracts. Existing data-backed screens remain
live; analytics unavailable states are explicit rather than fabricated.
