"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { segment: string; label: string }[] = [
  { segment: "", label: "Overview" },
  { segment: "members", label: "Members" },
  { segment: "invitations", label: "Invitations" },
  { segment: "roles", label: "Roles" },
  { segment: "activity", label: "Activity" },
];

export function TeamNav({ organizationId }: { organizationId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/organizations/${organizationId}/team`;

  return (
    <nav
      aria-label="Team sections"
      className="flex flex-wrap items-center gap-1 p-1 border border-[#dedede] rounded-full bg-white w-fit"
    >
      {ITEMS.map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active = item.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base || pathname === `${base}/`;
        return (
          <Link
            key={item.segment || "overview"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center h-[32px] px-3.5 rounded-full text-[13px] font-medium transition-colors ${
              active
                ? "bg-[#171717] text-white"
                : "text-[#666] hover:bg-[#f4f4f4] hover:text-[#171717]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
