"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SearchIcon } from "@/components/settings/icons";

export type SettingsUser = {
  name: string | null;
  email: string | null;
};

function initials(user: SettingsUser): string {
  const source = user.name?.trim() || user.email?.split("@")[0] || "";
  const letters = source.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const parts = letters.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The pill of the signed in account.
 *
 * It shows the avatar of the account and opens a menu with the destinations
 * of the account itself and with the sign out action.
 */
function UserMenu({ user }: { user: SettingsUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please retry.");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not sign out. Please retry."
      );
    }
  }

  const label = user?.name?.trim() || user?.email || "Your account";

  return (
    <div className="relative shrink-0" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex h-[36px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#dedede] bg-white pr-3 pl-2 hover:bg-gray-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7047ff] text-[11px] font-semibold text-white">
          {user ? initials(user) : "?"}
        </span>
        <svg
          className="h-3.5 w-3.5 text-[#666] fill-none stroke-current stroke-[2] stroke-linecap-round stroke-linejoin-round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[12px] border border-[#dedede] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
        >
          <div className="border-b border-[#eeeeee] px-3 py-2.5">
            <p className="m-0 truncate text-[12px] font-medium text-[#171717]">
              {label}
            </p>
            {user?.email ? (
              <p className="m-0 mt-0.5 truncate text-[11px] text-[#666]">
                {user.email}
              </p>
            ) : null}
          </div>
          <Link
            href="/dashboard/settings/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-[#374151] no-underline transition-colors hover:bg-gray-50"
          >
            My profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="block w-full px-3 py-2 text-left text-[13px] text-[#b42318] transition-colors hover:bg-[#fdf4f4]"
          >
            Sign out
          </button>
          {error ? (
            <p className="m-0 border-t border-[#eeeeee] px-3 py-2 text-[11px] text-[#b42318]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The frame of the settings screens.
 *
 * Every screen of the area is a single white card: a top bar with the
 * breadcrumb, the search and the account, the header of the screen and the
 * content itself. The search filters the destinations of the dashboard and
 * leads to the dashboard from the other screens.
 */
export function SettingsFrame({
  breadcrumb,
  user,
  title,
  description,
  query,
  onQueryChange,
  searchHref = "/dashboard/settings",
  children,
}: {
  breadcrumb: ReactNode;
  user?: SettingsUser | null;
  title?: ReactNode;
  description?: ReactNode;
  query?: string;
  onQueryChange?: (value: string) => void;
  searchHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  function search(value: string) {
    const needle = value.trim();
    const target = needle
      ? `${searchHref}?q=${encodeURIComponent(needle)}`
      : searchHref;
    if (onQueryChange) {
      window.history.replaceState(null, "", target);
      return;
    }
    router.push(target);
  }

  return (
    <main className="settings-screen mx-auto w-full max-w-[1020px] rounded-[16px] border border-[#dedede] bg-white p-6 text-[#171717] shadow-xs">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {breadcrumb}

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#888]" />
            <input
              ref={input}
              type="search"
              name="q"
              aria-label="Search settings"
              value={onQueryChange ? (query ?? "") : undefined}
              defaultValue={onQueryChange ? undefined : (query ?? "")}
              onChange={(event) => onQueryChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                search(input.current?.value ?? "");
              }}
              placeholder="Search settings..."
              className="h-[36px] w-full rounded-full border border-[#dedede] bg-transparent pr-4 pl-9 text-[13px] text-[#171717] outline-none placeholder-[#888] focus:border-[#7047ff] focus:ring-1 focus:ring-[#7047ff]"
            />
          </div>

          <UserMenu user={user ?? null} />
        </div>
      </div>

      {title ? (
        <div className="mb-8">
          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#171717]">
            {title}
          </h1>
          {description ? (
            <p className="m-[4px_0_0] text-[14px] text-[#666]">{description}</p>
          ) : null}
        </div>
      ) : null}

      {children}
    </main>
  );
}
