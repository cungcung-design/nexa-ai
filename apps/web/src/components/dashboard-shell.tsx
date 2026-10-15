"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronDown,
  CreditCard,
  Database,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sun,
  Workflow,
  X,
  Code2,
} from "lucide-react";
import type { Organization, User } from "@/lib/api";

const SECTIONS = [
  { name: "AI Agents", segment: "agents", icon: Bot },
  { name: "Playground", segment: "playground", icon: MessageSquare },
  { name: "Conversations", segment: "conversations", icon: MessageSquare },
  { name: "Knowledge Base", segment: "knowledge", icon: Database },
  { name: "Workflows", segment: "workflows", icon: Workflow },
  { name: "Approvals", segment: "approvals", icon: ShieldCheck },
  { name: "Deployments", segment: "deployments", icon: Code2 },
  { name: "Analytics", segment: "analytics", icon: Activity },
  { name: "Evaluations", segment: "evaluations", icon: FlaskConical },
  { name: "Billing", segment: "billing", icon: CreditCard },
  { name: "Settings", segment: "settings", icon: Settings },
];

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
  const [collapsed, setCollapsed] = useState(false);
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

  const activeOrg =
    organizations.find((o) => o.id === params.organizationId) ?? null;
  const fallbackOrg = organizations[0] ?? null;
  const navOrg = activeOrg ?? fallbackOrg;

  function hrefFor(segment: string) {
    if (!navOrg) return "/dashboard";
    if (segment === "evaluations") {
      return `/dashboard/evaluations?orgId=${encodeURIComponent(navOrg.id)}`;
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

  const currentSection = SECTIONS.find((s) =>
    s.segment === "evaluations"
      ? pathname === "/dashboard/evaluations"
      : pathname.startsWith(`/dashboard/organizations/`) &&
        pathname.includes(`/${s.segment}`)
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3 rounded-lg text-base font-semibold"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
            <BrainCircuit className="size-5" />
          </span>
          {!collapsed && <span className="truncate">Nexa AI</span>}
        </Link>
        <button
          aria-label="Close navigation"
          onClick={() => {
            setMobileOpen(false);
            menuTrigger.current?.focus();
          }}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>
      {!collapsed && (
        <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-white/[.04] p-3">
          <label
            htmlFor="org-select"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Workspace
          </label>
          <div className="relative">
            <select
              id="org-select"
              value={activeOrg?.id ?? ""}
              onChange={(e) => changeOrg(e.target.value)}
              disabled={!organizations.length}
              className="min-h-10 w-full appearance-none rounded-md bg-transparent pr-6 text-sm font-medium text-zinc-100 focus-visible:outline-none disabled:text-zinc-500"
            >
              <option className="bg-zinc-900" value="">
                {organizations.length
                  ? "Choose workspace"
                  : "No organizations"}
              </option>
              {organizations.map((org) => (
                <option
                  className="bg-zinc-900"
                  key={org.id}
                  value={org.id}
                >
                  {org.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-0 size-4 text-zinc-400" />
          </div>
        </div>
      )}
      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-1 overflow-y-auto px-2 py-2"
      >
          <Link
            href="/dashboard"
            title={collapsed ? "Overview" : undefined}
            onClick={() => setMobileOpen(false)}
            className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              pathname === "/dashboard"
                ? "bg-violet-500/10 font-semibold text-violet-700"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <LayoutDashboard className="size-5 shrink-0" />
            {!collapsed && "Overview"}
          </Link>
          {SECTIONS.map(({ name, segment, icon: Icon }) => {
            const href = hrefFor(segment);
            const isActive = segment === "evaluations"
              ? pathname === "/dashboard/evaluations"
              : (activeOrg && currentSection?.segment === segment) ||
                (!activeOrg && pathname === href);
            return (
              <Link
                key={segment}
                href={href}
                title={collapsed ? name : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-violet-500/10 font-semibold text-violet-700"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
              <Icon className="size-5 shrink-0" />
              {!collapsed && name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-700/40 text-sm font-semibold text-violet-200">
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user.full_name || "Account"}
              </p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          )}
          <button
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign out"
            className="text-zinc-400 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="app-shell"
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
        className={`fixed inset-y-0 left-0 z-50 border-r border-white/10 bg-[#111019] transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } w-[248px] lg:translate-x-0 ${
          collapsed ? "lg:w-[68px]" : "lg:w-[248px]"
        }`}
      >
        {sidebar}
      </aside>
      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]"
        }`}
      >
        <header className="app-header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuTrigger}
              className="rounded-lg p-2 hover:bg-white/5 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
            >
              <Menu className="size-5" />
            </button>
            <button
              className="hidden rounded-lg p-2 text-zinc-400 hover:bg-white/5 lg:block"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={
                collapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-zinc-500 sm:inline">
                {activeOrg?.name ?? "Workspace"}
              </span>
              {activeOrg && <span aria-hidden="true" className="text-zinc-500">/</span>}
              <span className="truncate font-medium text-zinc-100">
                {pathname === "/dashboard"
                  ? "Overview"
                  : (currentSection?.name ?? "Overview")}
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                setTheme(next);
                window.localStorage.setItem("nexa-theme", next);
              }}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="grid size-10 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <span className="hidden max-w-48 truncate rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 md:inline">
              {activeOrg?.name ?? "Select a workspace"}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
