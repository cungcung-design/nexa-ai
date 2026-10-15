"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Box,
  ChevronDown,
  Clock3,
  FolderOpen,
  FolderTree,
  Globe,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Shapes,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  Book,
  ChartPie,
  X,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { Organization, User } from "@/lib/api";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

const NAVIGATION: { name: string; icon: SVGIcon; segment: string }[] = [
  { name: "Dashboard", icon: Shapes, segment: "overview" },
  { name: "Workflows", icon: FolderTree, segment: "workflows" },
  { name: "AI Agents", icon: WandSparkles, segment: "agents" },
  { name: "Knowledge Base", icon: Book, segment: "knowledge" },
  { name: "Analytics", icon: ChartPie, segment: "analytics" },
  { name: "Integrations", icon: Globe, segment: "integrations" },
  { name: "Human-in-the-Loop", icon: ShieldCheck, segment: "approvals" },
  { name: "Team", icon: Users, segment: "team" },
  { name: "Audit Logs", icon: Clock3, segment: "audit" },
  { name: "Settings", icon: Settings, segment: "settings" },
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
    if (segment === "overview") {
      return `/dashboard/organizations/${encodeURIComponent(navOrg.id)}`;
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
            <span>NEXORA</span>{" "}
            <span className="text-blue-600 font-light">AI</span>
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
          className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 text-sm font-medium"
        >
          {NAVIGATION.map(({ name, icon: Icon, segment }) => {
            const href = hrefFor(segment);
            const isActive = isNavActive(segment);
            return (
              <Link
                key={name}
                href={href}
                title={name}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors ${
                  isActive
                    ? "bg-blue-50/80 text-blue-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span>{name}</span>
              </Link>
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
            <button
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
              className="text-slate-400 hover:text-slate-900"
            >
              <LogOut className="size-4" />
            </button>
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
