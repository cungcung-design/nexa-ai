"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS: { label: string; segment: string }[] = [
  { label: "Overview", segment: "analytics" },
  { label: "Agents", segment: "analytics/agents" },
  { label: "Usage", segment: "analytics/usage" },
  { label: "Traces", segment: "analytics/traces" },
  { label: "Evaluations", segment: "analytics/evaluations" },
  { label: "Workflows", segment: "analytics/workflows" },
  { label: "Knowledge", segment: "analytics/knowledge" },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ organizationId: string }>();
  const pathname = usePathname();
  const orgId = params.organizationId ?? "";

  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);

  const isActive = (segment: string, exact = false) => {
    if (!orgId) return false;
    const base = `/dashboard/organizations/${encodeURIComponent(orgId)}/${segment}`;
    if (exact) return pathname === base;
    return pathname === base || pathname.startsWith(base + "/");
  };

  const activeTab = TABS.find(
    (tab) => isActive(tab.segment, tab.label === "Overview") === true
  );

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (reduceMotion || !activeTab) return;
    const el = tabRefs.current[activeTab.segment];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const navRect = el.parentElement?.getBoundingClientRect();
    if (!navRect) return;
    setIndicator({
      x: rect.left - navRect.left,
      width: rect.width,
    });
  }, [pathname, orgId, activeTab, reduceMotion]);

  return (
    <div className="space-y-6">
      {/* Sticky Navigation Tabs */}
      <div className="sticky top-16 z-30 bg-gray-50/90 backdrop-blur-md border-b border-gray-200 pt-2 pb-4">
        <div className="relative flex gap-8 overflow-x-auto no-scrollbar">
          {/* Sliding underline indicator */}
          {!reduceMotion && (
            <div
              className="absolute bottom-0 h-[2px] bg-gray-900 rounded-full pointer-events-none transition-all duration-200 ease-out"
              style={{
                transform: `translateX(${indicator.x}px)`,
                width: indicator.width,
              }}
            />
          )}

          {TABS.map((tab) => {
            const active = isActive(tab.segment, tab.label === "Overview");
            const href = `/dashboard/organizations/${encodeURIComponent(orgId)}/${tab.segment}`;
            return (
              <Link
                key={tab.label}
                ref={(el) => {
                  tabRefs.current[tab.segment] = el;
                }}
                href={href}
                className={`pb-3 border-b-2 whitespace-nowrap px-2 shrink-0 transition-all duration-200 ease-out ${
                  active
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
