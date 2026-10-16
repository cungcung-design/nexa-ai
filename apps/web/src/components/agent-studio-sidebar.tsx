"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Book,
  FileText,
  Layers,
  MessageCircle,
  Rocket,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type SVGIcon = ComponentType<SVGProps<SVGSVGElement>>;

const STUDIO_NAV: { name: string; icon: SVGIcon; segment: string }[] = [
  { name: "Overview", icon: MessageCircle, segment: "overview" },
  { name: "Instructions", icon: FileText, segment: "instructions" },
  { name: "Model", icon: Settings, segment: "model" },
  { name: "Knowledge", icon: Book, segment: "knowledge" },
  { name: "Tools", icon: ShieldCheck, segment: "tools" },
  { name: "Memory", icon: User, segment: "memory" },
  { name: "Versions", icon: Layers, segment: "versions" },
  { name: "Deployment", icon: Rocket, segment: "deployments" },
];

export function AgentStudioSidebar({
  agentId,
}: {
  agentId: string;
}) {
  const params = useParams<{ organizationId: string; agentId: string }>();
  const pathname = usePathname();
  const orgId = params.organizationId ?? "";

  const base = `/dashboard/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/studio`;

  function isActive(segment: string): boolean {
    const expected = `${base}/${segment}`;
    return pathname === expected || pathname.startsWith(expected + "/");
  }

  return (
    <div className="flex flex-col space-y-1">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">
        Configuration
      </p>
      {STUDIO_NAV.map(({ name, icon: Icon, segment }) => {
        const active = isActive(segment);
        const href = `${base}/${segment}`;
        return (
          <Link
            key={name}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors duration-200 ease-out ${
              active
                ? "bg-indigo-50/70 border border-indigo-100/60 text-indigo-600 font-semibold shadow-2xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-gray-400"}`} />
            {name}
          </Link>
        );
      })}
    </div>
  );
}
