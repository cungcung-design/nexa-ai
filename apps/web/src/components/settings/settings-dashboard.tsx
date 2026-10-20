"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  SettingsFrame,
  type SettingsUser,
} from "@/components/settings/settings-frame";

/**
 * The settings dashboard.
 *
 * The page is a transcription of the settings design: a white card with a top
 * bar (breadcrumb, search and the account), the header of the screen and the
 * two groups of destinations, each one a card with a header bar, a chip that
 * names the scope and a list of rows.
 *
 * The icons are the shared symbols of the design, drawn once in the sprite
 * below and placed with `use`, exactly like the reference does.
 */

type Destination = {
  href: string;
  title: string;
  description: string;
  icon: string;
};

const ICON_CLASS =
  "fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round";

const PERSONAL: Destination[] = [
  {
    href: "/dashboard/settings/profile",
    title: "My Profile",
    description:
      "View and edit your personal information, avatar, and display name.",
    icon: "user",
  },
  {
    href: "/dashboard/settings/preferences",
    title: "Preferences",
    description: "Customize your experience and default settings.",
    icon: "sliders",
  },
  {
    href: "/dashboard/settings/account-security",
    title: "Account Security",
    description:
      "Manage your password, multi-factor authentication, and login methods.",
    icon: "shield",
  },
  {
    href: "/dashboard/settings/notifications",
    title: "Notifications",
    description:
      "Control what you're notified about and how you receive updates.",
    icon: "bell",
  },
];

const WORKSPACE: Destination[] = [
  {
    href: "",
    title: "General",
    description:
      "The overview, the branding and the basic information of the workspace.",
    icon: "building",
  },
  {
    href: "/security",
    title: "Security",
    description: "Manage access controls, SSO, and security policies.",
    icon: "shield",
  },
  {
    href: "/ai",
    title: "AI Configuration",
    description:
      "Configure AI models, usage policies, and default behavior.",
    icon: "sparkles",
  },
  {
    href: "/developer",
    title: "API & Developer",
    description: "Manage API keys, webhooks, and developer settings.",
    icon: "code",
  },
  {
    href: "/data-privacy",
    title: "Data & Privacy",
    description:
      "Control your data, retention settings, and privacy preferences.",
    icon: "database",
  },
  {
    href: "/advanced",
    title: "Advanced",
    description: "Manage advanced settings and experimental features.",
    icon: "sliders",
  },
];

/**
 * The shared symbols of the design.
 */
function IconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <symbol id="settings-search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </symbol>
        <symbol id="settings-user-group" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </symbol>
        <symbol id="settings-user" viewBox="0 0 24 24">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </symbol>
        <symbol id="settings-sliders" viewBox="0 0 24 24">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </symbol>
        <symbol id="settings-shield" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </symbol>
        <symbol id="settings-bell" viewBox="0 0 24 24">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </symbol>
        <symbol id="settings-building" viewBox="0 0 24 24">
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
        </symbol>
        <symbol id="settings-sparkles" viewBox="0 0 24 24">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </symbol>
        <symbol id="settings-code" viewBox="0 0 24 24">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </symbol>
        <symbol id="settings-database" viewBox="0 0 24 24">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </symbol>
        <symbol id="settings-chevron-right" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </symbol>
      </defs>
    </svg>
  );
}

/**
 * A group of destinations: a card with a header bar, the scope of the group
 * and the rows of the destinations.
 */
function Group({
  title,
  description,
  icon,
  chip,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  chip: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 border border-[#dedede] rounded-[14px] bg-white overflow-hidden last:mb-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#dedede] bg-[#fafafa]">
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 text-[#555] ${ICON_CLASS}`}
            aria-hidden="true"
          >
            <use href={`#settings-${icon}`} />
          </svg>
          <h2 className="m-0 text-[14px] font-semibold text-[#171717]">
            {title}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f0f1ff] text-[#7047ff]">
            {chip}
          </span>
        </div>
      </div>

      <p className="px-6 pt-3.5 pb-1 m-0 text-[12px] text-[#666]">
        {description}
      </p>

      <div className="divide-y divide-[#eeeeee]">{children}</div>
    </section>
  );
}

/**
 * A row of a group: the destination with its icon, its title and its
 * description, and the chevron that leads to it.
 */
function Row({ item }: { item: Destination }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors text-inherit no-underline group"
    >
      <div className="flex items-center gap-3.5">
        <svg
          className={`w-4 h-4 text-[#666] ${ICON_CLASS} shrink-0`}
          aria-hidden="true"
        >
          <use href={`#settings-${item.icon}`} />
        </svg>
        <div>
          <h3 className="m-0 text-[13px] font-semibold text-[#171717]">
            {item.title}
          </h3>
          <p className="m-0 text-[12px] text-[#666]">{item.description}</p>
        </div>
      </div>
      <svg
        className={`w-4 h-4 text-[#999] group-hover:text-[#171717] ${ICON_CLASS} shrink-0 transition-colors`}
        aria-hidden="true"
      >
        <use href="#settings-chevron-right" />
      </svg>
    </Link>
  );
}

/**
 * The settings dashboard.
 *
 * The personal and the workspace destinations are shown as two groups. The
 * search field of the top bar filters the destinations and the empty state is
 * shown when nothing matches.
 */
export function SettingsDashboard({
  organizationId,
  user,
}: {
  organizationId: string | null;
  user?: SettingsUser | null;
}) {
  const [query, setQuery] = useState("");

  const workspaceBase = organizationId
    ? `/dashboard/organizations/${organizationId}/settings`
    : "/dashboard/settings";

  const workspaceRoot = organizationId
    ? `/dashboard/organizations/${organizationId}`
    : "/dashboard";

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (item: Destination) =>
      !needle ||
      `${item.title} ${item.description}`.toLowerCase().includes(needle);

    return [
      {
        id: "personal",
        title: "Personal",
        description: "Manage your account, preferences, and personal settings.",
        icon: "user-group",
        chip: "For you",
        items: PERSONAL.filter(match),
      },
      {
        id: "workspace",
        title: "Workspace",
        description: "Configure and manage your workspace settings.",
        icon: "building",
        chip: "For your team",
        items: WORKSPACE.filter(match).map((item) => ({
          ...item,
          href: item.href ? `${workspaceBase}${item.href}` : workspaceRoot,
        })),
      },
    ];
  }, [query, workspaceBase, workspaceRoot]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <IconSprite />

      <SettingsFrame
        breadcrumb={
          <div>
            <p className="m-0 text-[12px] text-[#777] font-medium leading-[16px]">
              Workspace &nbsp;/&nbsp; Settings
            </p>
          </div>
        }
        user={user ?? null}
        title="Settings"
        description="Manage your personal preferences and workspace configuration."
        query={query}
        onQueryChange={setQuery}
      >
        {groups.map((group) =>
          group.items.length ? (
            <Group
              key={group.id}
              title={group.title}
              description={group.description}
              icon={group.icon}
              chip={group.chip}
            >
              {group.items.map((item) => (
                <Row key={item.href} item={item} />
              ))}
            </Group>
          ) : null
        )}

        {total === 0 ? (
          <p
            className="m-0 rounded-[14px] border border-dashed border-[#dedede] bg-[#fcfcfc] px-6 py-10 text-center text-[13px] text-[#666]"
            id="empty"
            role="status"
          >
            No matching settings.
          </p>
        ) : null}
      </SettingsFrame>
    </>
  );
}
