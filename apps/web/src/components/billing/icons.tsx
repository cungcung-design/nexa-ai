/**
 * Billing icons.
 *
 * The paths are the exact artwork of the approved Billing design, including
 * the stroke width, line caps and join style of the reference.
 */

type IconProps = {
  className?: string;
};

const BASE = "w-4 h-4 fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round";

export function SparklesIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      <path d="M20 2v4M18 4h4" />
    </svg>
  );
}

export function DiamondIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 3-4 6 10 12L22 9l-4-6H6Z" />
      <path d="M2 9h20M9 3 7 9l5 12 5-12-2-6" />
    </svg>
  );
}

export function WalletIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v13H5a2 2 0 0 1-2-2V5" />
      <path d="M20 11h-5v5h5" />
      <path d="M17.5 13.5h.01" />
    </svg>
  );
}

export function BotIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 8V5M9 12v2M15 12v2" />
    </svg>
  );
}

export function CalendarIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 2v5M16 2v5M4 10h16" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}

export function ArrowIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({
  className = "w-[15px] h-[15px] shrink-0 fill-none stroke-[#28a745] stroke-[1.8] stroke-linecap-round stroke-linejoin-round",
}: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 5L19 4" />
    </svg>
  );
}

export function DownloadIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />
    </svg>
  );
}

export function PlusIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CreditCardIcon({ className = BASE }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function BuildingIcon({
  className = "w-4 h-4 shrink-0 fill-none stroke-[#7047ff] stroke-[1.7] stroke-linecap-round stroke-linejoin-round",
}: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18M5 21V5h9v16M14 11h5v10" />
      <path d="M9 8h1M9 12h1M9 16h1" />
    </svg>
  );
}
