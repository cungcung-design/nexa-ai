/**
 * The icons of the sign in and sign up pages.
 *
 * Every glyph uses the paths of the supplied design so the pages show the
 * same artwork as the reference.
 */

type IconProps = {
  className?: string;
};

export function LoginIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v16h-6M3 12h12m-5-5 5 5-5 5" />
    </svg>
  );
}

export function AccountIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m4-14v6m-3-3h6" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function BrainIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a3 3 0 0 0-5.8-1A4 4 0 0 0 4 11a4 4 0 0 0 1 7.5A3.5 3.5 0 0 0 12 19V5Zm0 0a3 3 0 0 1 5.8-1A4 4 0 0 1 20 11a4 4 0 0 1-1 7.5A3.5 3.5 0 0 1 12 19" />
      <path d="M8 4v4m-4 3h4m-3 7 3-2v-3m8-9v4m4 3h-4m3 7-3-2v-3" />
    </svg>
  );
}

export function WorkflowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4H5v4m7-4h7v4" />
    </svg>
  );
}

export function BotIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="7" width="14" height="13" rx="4" />
      <path d="M12 3v4M2 11v5m20-5v5M9 12v2m6-2v2m-6 3h6" />
    </svg>
  );
}

export function HeadsetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13v-2a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3" />
      <rect x="2" y="11" width="5" height="8" rx="2" />
      <rect x="17" y="11" width="5" height="8" rx="2" />
    </svg>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12h18m-11 0v4h4v-4" />
    </svg>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21V3h12v18M16 9h4v12M2 21h20M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1m-3 6v-3" />
    </svg>
  );
}

export function CloudIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11h-3M12 21V10m-4 4 4-4 4 4" />
    </svg>
  );
}

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.51l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.78.51 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}
