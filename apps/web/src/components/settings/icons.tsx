/**
 * The icons of the settings screens.
 *
 * Every path is copied from the settings design so the rendered icons match
 * the reference exactly: same shape, same strokes, same view box.
 */

type IconProps = {
  className?: string;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({
  className,
  children,
  viewBox = "0 0 24 24",
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      aria-hidden="true"
      {...STROKE}
    >
      {children}
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function ProfileUserIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </Svg>
  );
}

export function SlidersNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 5h10m4 0h4M3 12h4m4 0h10M3 19h10m4 0h4" />
      <path d="M13 2v6M7 9v6m10 1v6" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </Svg>
  );
}

export function ShieldNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m12 3-8 4v5c0 5 8 9 8 9s8-4 8-9V7l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

export function BellNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </Svg>
  );
}

export function BuildingNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 21h18M5 21V5h10v16m0-12h4v12" />
      <path d="M9 8h2m-2 4h2m-2 4h2" />
    </Svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </Svg>
  );
}

export function LockNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </Svg>
  );
}

export function BrainIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 18V5a3 3 0 0 0-5.8-1A4 4 0 0 0 4 11a4 4 0 0 0 1 7.8A3.5 3.5 0 0 0 12 18Z" />
      <path d="M8 5v3M5 12h3M8 16v3M15 5h3l2-2M15 10h6M15 15h3l3 3M15 20h3" />
    </Svg>
  );
}

export function BrainNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5a3 3 0 0 0-5.8-1A4 4 0 0 0 4 11a4 4 0 0 0 1 7.5A3.5 3.5 0 0 0 12 19Z" />
      <path d="M8 4v4m-4 3h4m-3 7.5L8 16v-3m4-5H9" />
      <path d="M12 5a3 3 0 0 1 5.8-1M12 12h5l2 3h2m-9 4h4v-3m0-8h5m-4-4v4" />
    </Svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.5 3a6.5 6.5 0 0 0-6.2 8.4L2 17.7V22h4.3v-3h3v-3l2.3-2.3A6.5 6.5 0 1 0 14.5 3Z" />
      <circle cx="16" cy="8" r="1" />
    </Svg>
  );
}

export function KeyNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15.5 3a5.5 5.5 0 0 0-5.1 7.6L4 17v4h4v-3h3v-3l2.4-2.4A5.5 5.5 0 1 0 15.5 3Z" />
      <circle cx="16" cy="7.5" r=".75" />
    </Svg>
  );
}

export function DatabaseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </Svg>
  );
}

export function DatabaseNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </Svg>
  );
}

export function AdvancedIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 7h7M16 7h5M3 17h3M12 17h9" />
      <circle cx="13" cy="7" r="3" />
      <circle cx="9" cy="17" r="3" />
    </Svg>
  );
}

export function AdvancedNavIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h8m6 0h2M4 17h2m6 0h8" />
      <circle cx="15" cy="7" r="3" />
      <circle cx="9" cy="17" r="3" />
    </Svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </Svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9 3-.6 2.2-2 .9-2.1-.6-2 3.5 1.6 1.6-.2 2.2L2 14.4l2 3.5 2.2-.6 1.8 1.1.6 2.2h4l.6-2.2 1.9-1.1 2.2.6 2-3.5-1.7-1.6v-2.2l1.7-1.6-2-3.5-2.2.6-1.9-1L12.6 3Z" />
      <circle cx="10.5" cy="11.8" r="3" />
    </Svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function SelectChevronIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m4 8 8 8 8-8" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10.3 4.5 2.8 17.4A2 2 0 0 0 4.5 20.4h15a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </Svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

export function BotIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="8" width="16" height="12" rx="4" />
      <path d="M12 4v4" />
      <path d="M9 13v1M15 13v1" />
      <path d="M2 12v3M22 12v3" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  );
}

export function ApprovalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function WorkflowIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M6.5 10v5a3 3 0 0 0 3 3H14" />
    </Svg>
  );
}

export function AgentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 5v3" />
      <path d="M9 12v1M15 12v1" />
    </Svg>
  );
}

export function SecurityIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </Svg>
  );
}

export function BillingIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h4" />
    </Svg>
  );
}

export function UserGroupIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </Svg>
  );
}

export function CodeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </Svg>
  );
}
