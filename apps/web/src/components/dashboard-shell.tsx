"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  Box,
  ChevronDown,
  Clock3,
  CreditCard,
  FolderOpen,
  FolderTree,
  Globe,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Shapes,
  Sparkles,
  Sun,
  User as UserIcon,
  Users,
  WandSparkles,
  Book,
  ChartPie,
  X,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { Organization, User } from "@/lib/api";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  name: string;
  icon: SVGIcon;
  segment: string;
  requiredRole?: ("OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER")[];
  missingPage?: boolean;
};

function AnalyticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20v-4M8 20v-7M12 20v-4M16 20V10M20 20V5" />
      <path d="m3 12 6-6 5 4 7-8" />
    </svg>
  );
}

function AuditLogsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3h5" />
      <path d="M5 3h12a2 2 0 0 1 2 2v13" />
      <path d="M8 3v16a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3h-9v3a2 2 0 0 1-2 2" />
      <path d="M11 7h5M11 11h5" />
    </svg>
  );
}

const DASHBOARD_ITEM: NavItem = {
  name: "Dashboard",
  icon: Shapes,
  segment: "overview",
};

const BUILD_AUTOMATE_ITEMS: NavItem[] = [
  { name: "AI Agents", icon: WandSparkles, segment: "agents" },
  { name: "Workflows", icon: FolderTree, segment: "workflows" },
  { name: "Knowledge Base", icon: Book, segment: "knowledge" },
  { name: "Integrations", icon: Globe, segment: "integrations" },
];

const MONITOR_OPERATE_ITEMS: NavItem[] = [
  { name: "Conversations", icon: MessageCircle, segment: "conversations" },
  { name: "Approvals", icon: ShieldCheck, segment: "approvals" },
  { name: "Analytics", icon: AnalyticsIcon, segment: "analytics" },
  { name: "Audit Logs", icon: AuditLogsIcon, segment: "audit-logs" },
];

const WORKSPACE_ITEMS: NavItem[] = [
  {
    name: "Team",
    icon: Users,
    segment: "team",
  },
  {
    name: "Billing",
    icon: CreditCard,
    segment: "billing",
  },
   { name: "Settings", icon: Settings, segment: "settings" },
 ];

type NavSection = {
  label: string | null;
  items: NavItem[];
  collapsible: boolean;
  defaultOpen?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  { label: null, items: [DASHBOARD_ITEM], collapsible: false },
  {
    label: "Build & Automate",
    items: BUILD_AUTOMATE_ITEMS,
    collapsible: true,
    defaultOpen: true,
  },
  {
    label: "Monitor & Operate",
    items: MONITOR_OPERATE_ITEMS,
    collapsible: true,
    defaultOpen: true,
  },
  {
    label: "Workspace",
    items: WORKSPACE_ITEMS,
    collapsible: true,
    defaultOpen: true,
  },
];

const MANAGE_ROLES = new Set(["OWNER", "ADMIN"]);
const REVIEW_ROLES = new Set(["OWNER", "ADMIN", "DEVELOPER"]);
const VIEW_ROLES = new Set(["OWNER", "ADMIN", "DEVELOPER", "VIEWER"]);

function roleAllows(item: NavItem, userRole: string | null | undefined): boolean {
  if (!item.requiredRole || item.requiredRole.length === 0) return true;
  if (!userRole) return false;
  const allowed = new Set(item.requiredRole);
  return allowed.has(userRole as "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER");
}

function rememberOrganization(id: string) {
  document.cookie = `nexa_active_org=${encodeURIComponent(
    id
  )};path=/;max-age=31536000;samesite=lax`;
}

export function DashboardShell({
  user,
  organizations,
  children,
}: {
  user: User;
  organizations: Organization[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ organizationId?: string }>();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buildAutomateOpen, setBuildAutomateOpen] = useState(true);
  const [monitorOperateOpen, setMonitorOperateOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("nexa-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [logoutError, setLogoutError] = useState("");
  const menuTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuTrigger.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  useEffect(() => {
    if (
      organizations.length === 0 &&
      !params.organizationId &&
      pathname !== "/dashboard/organizations/new"
    ) {
      router.replace("/dashboard/organizations/new");
    }
  }, [organizations, params.organizationId, pathname, router]);

  const activeOrg =
    organizations.find((o) => o.id === params.organizationId) ?? null;
  const fallbackOrg = organizations[0] ?? null;
  const navOrg = activeOrg ?? fallbackOrg;
  const userRole = activeOrg?.role ?? null;

  function hrefFor(segment: string) {
    if (!navOrg) return "/dashboard";
    if (segment === "overview") {
      return `/dashboard/organizations/${encodeURIComponent(navOrg.id)}`;
    }
    if (segment === "settings") {
      return "/dashboard/settings";
    }
    return `/dashboard/organizations/${navOrg.id}/${segment}`;
  }

  function changeOrg(id: string) {
    rememberOrganization(id);
    if (pathname === "/dashboard/evaluations") {
      router.push(`/dashboard/evaluations?orgId=${encodeURIComponent(id)}`);
      setMobileOpen(false);
      return;
    }
    const match = pathname.match(
      /^\/dashboard\/organizations\/[^/]+(\/.*)?$/
    );
    if (match) {
      const rest = match[1] ?? "";
      router.push(`/dashboard/organizations/${id}${rest}`);
    } else {
      router.push(`/dashboard/organizations/${id}`);
    }
    setMobileOpen(false);
  }

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please retry.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Could not sign out. Please retry."
      );
    }
  }

  function isNavActive(segment: string): boolean {
    if (segment === "overview") {
      return (
        pathname === "/dashboard" ||
        (!!activeOrg &&
          pathname === `/dashboard/organizations/${encodeURIComponent(activeOrg.id)}`)
      );
    }
    if (segment === "settings") {
      if (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) {
        return true;
      }
      const settingsPath = `/dashboard/organizations/${params?.organizationId}/settings`;
      return pathname.startsWith(settingsPath);
    }
    const orgId = params?.organizationId;
    if (!orgId) return false;
    const expectedPath = `/dashboard/organizations/${orgId}/${segment}`;
    return pathname === expectedPath || pathname.startsWith(expectedPath + "/");
  }

  return (
    <div
      className="app-shell flex min-h-screen flex-col"
      data-theme={theme}
      suppressHydrationWarning
    >
      {mobileOpen && (
        <button
          aria-label="Dismiss navigation"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => {
            setMobileOpen(false);
            menuTrigger.current?.focus();
          }}
        />
      )}
      {logoutError && (
        <p
          role="alert"
          className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          {logoutError}
        </p>
      )}
      <aside
        id="app-navigation"
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-100 bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } w-64 lg:translate-x-0`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Link
            href={navOrg ? hrefFor("overview") : "/dashboard"}
            className="flex min-w-0 items-center gap-3 text-xl font-bold text-slate-900"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shadow-md shadow-blue-500/20">
              <Box className="size-4" />
            </span>
            <span>NEXORA</span>
          </Link>
          <button
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false);
              menuTrigger.current?.focus();
            }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-900 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-[5px] overflow-y-auto no-scrollbar px-3 py-4"
        >
          {NAV_SECTIONS.map((section, sectionIndex) => {
            const isCollapsible = section.collapsible;
            const isOpenRef = sectionIndex === 1 ? buildAutomateOpen : sectionIndex === 2 ? monitorOperateOpen : workspaceOpen;
            const setOpenRef =
              sectionIndex === 1
                ? setBuildAutomateOpen
                : sectionIndex === 2
                ? setMonitorOperateOpen
                : setWorkspaceOpen;
            const isOpen = isCollapsible ? isOpenRef : true;

            return (
              <React.Fragment key={section.label ?? String(sectionIndex)}>
                {section.label && (
                  <button
                    type="button"
                    onClick={() => setOpenRef((prev: boolean) => !prev)}
                    className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {section.label}
                    </p>
                    <ChevronDown
                      className={`size-3.5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}

                {isOpen &&
                  section.items
                    .filter((item) => roleAllows(item, userRole))
                    .map((item) => {
                      if (item.missingPage) {
                        return (
                          <div
                            key={item.name}
                            title={`${item.name} (page not yet implemented)`}
                            aria-disabled={true}
                            className={`flex items-center gap-[14px] w-full h-[46px] px-[14px] border border-transparent rounded-[12px] bg-transparent text-slate-400 text-[13px] font-semibold text-left shrink-0 transition-all opacity-60 cursor-not-allowed`}
                          >
                            <item.icon className="size-4 shrink-0" />
                            <span>{item.name}</span>
                          </div>
                        );
                      }

                      const href = hrefFor(item.segment);
                      const isActive = isNavActive(item.segment);

                      return (
                        <Link
                          key={item.name}
                          href={href}
                          title={item.name}
                          onClick={() => setMobileOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-center gap-[14px] w-full h-[46px] px-[14px] border border-transparent rounded-[12px] bg-transparent text-[#374151] text-[13px] font-semibold text-left cursor-pointer shrink-0 transition-all ${
                            isActive
                              ? "text-[#4265db] border-white/80 bg-[linear-gradient(105deg,#f1f5ff_0%,#e4eaff_100%)] shadow-[0_4px_9px_rgba(91,119,210,0.13),inset_0_0_5px_rgba(255,255,255,0.65)]"
                              : ""
                          } hover:bg-[#0a0a0a03] focus-visible:outline-[2px] focus-visible:outline-[#4265db] focus-visible:outline-offset-[3px]`}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/50 to-white p-3.5 text-center">
            <Sparkles className="mx-auto mb-1.5 size-5 text-blue-600" />
            <p className="text-xs font-semibold text-slate-700">AI Copilot</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Ask me anything about your workflows
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="flex min-w-0 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-sm font-semibold text-white">
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.full_name || "Arif Rahman"}
                </p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
            <div className="relative inline-block">
              <button
                onClick={() => void logout()}
                aria-label="Account menu"
                title="Account menu"
                className="text-slate-400 hover:text-slate-900"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto lg:pl-64">
        <header className="app-header sticky top-0 z-30 h-16 flex items-center justify-between border-b border-slate-100 px-4 backdrop-blur-xl sm:px-6 bg-white/80">
          <div className="flex items-center gap-2.5">
            <button
              ref={menuTrigger}
              className="rounded-lg p-2 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
            >
              <Menu className="size-5" />
            </button>
            <Link
              href={navOrg ? hrefFor("workflows") : "/dashboard"}
              aria-label="Open folder"
              title="Open folder"
              className="grid size-10 place-items-center rounded-xl bg-[#f4f7fc] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <FolderOpen className="size-5" />
            </Link>
            <div className="relative hidden max-w-md sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
              <input
                type="text"
                placeholder="Search workflows, agents, docs..."
                className="w-full bg-[#f4f7fc] text-xs text-slate-700 pl-9 pr-12 py-2 rounded-xl border border-transparent focus:border-blue-300 focus:bg-white outline-none transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs font-mono">
                ⌘K
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                setTheme(next);
                window.localStorage.setItem("nexa-theme", next);
              }}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            {organizations.length > 1 && (
              <div className="relative hidden md:block">
                <select
                  id="org-select"
                  value={activeOrg?.id ?? ""}
                  onChange={(e) => changeOrg(e.target.value)}
                  aria-label="Select workspace"
                  className="appearance-none rounded-xl bg-[#f4f7fc] px-3 py-2 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option className="bg-white" value="">
                    Choose workspace
                  </option>
                  {organizations.map((org) => (
                    <option className="bg-white" key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
              </div>
            )}
            <button
              type="button"
              aria-label="Notifications"
              title="Notifications"
              className="relative grid size-10 place-items-center rounded-xl bg-[#f4f7fc] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Bell className="size-5" />
              <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-rose-500" />
            </button>
            <Link
              href={navOrg ? hrefFor("workflows") : "/dashboard"}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:px-4"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Workflow</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
