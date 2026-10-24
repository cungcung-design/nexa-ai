import Link from "next/link";
import type { ReactNode } from "react";
import { formatTimestamp as formatUtcTimestamp } from "@/lib/format-time";

/** The white workspace card used by every Team screen. */
export function TeamCard({
  children,
  className = "",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`w-full ${wide ? "max-w-[950px]" : "max-w-[900px]"} mx-auto p-[20px_20px_16px] border border-[#dedede] rounded-[13px] bg-white shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export function TeamFooterNote({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 border-t border-[#dedede]">
      <p className="m-0 text-[12px] leading-[17px] text-[#777]">{children}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  iconClassName = "",
  iconBackground = "",
  href,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconClassName?: string;
  iconBackground?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div>
        <p className="m-0 text-[12px] text-[#777] font-medium">{label}</p>
        <p className="m-[4px_0_0] text-[22px] font-bold tracking-tight">{value}</p>
      </div>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClassName} ${iconBackground}`}
      >
        {icon}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between transition-colors hover:border-gray-300"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="p-4 border border-[#dedede] rounded-[11px] bg-white flex items-center justify-between">
      {inner}
    </div>
  );
}

/** Two letter avatar derived from the member email. */
export function initialsFor(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const localLetter = local.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "U";
  const domainLetter = domain.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "";
  return (localLetter + domainLetter).toUpperCase();
}

export function Avatar({
  email,
  size = "md",
  tone = "indigo",
}: {
  email: string;
  size?: "md" | "lg";
  tone?: "indigo" | "blue";
}) {
  const sizing =
    size === "lg"
      ? "w-14 h-14 text-[18px]"
      : "w-9 h-9 text-[13px]";
  const colors =
    tone === "blue"
      ? "bg-[#dbeafe] text-[#2563eb]"
      : "bg-[#f1f5ff] text-[#6366ff]";
  return (
    <div
      className={`${sizing} ${colors} rounded-full font-semibold flex items-center justify-center shrink-0`}
    >
      {initialsFor(email)}
    </div>
  );
}

export function RoleBadge({ label }: { label: string }) {
  return (
    <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#f2f2f2] text-[#333] shrink-0">
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    ACTIVE: "bg-[#e0f2df] text-[#28a745]",
    SUSPENDED: "bg-[#fce5da] text-[#e85b0b]",
    INVITED: "bg-[#fce5da] text-[#e85b0b]",
    PENDING: "bg-[#fffbeb] text-[#d77d00]",
    ACCEPTED: "bg-[#e0f2df] text-[#28a745]",
    REVOKED: "bg-[#f2f2f2] text-[#777]",
    EXPIRED: "bg-[#f2f2f2] text-[#777]",
  };
  const label: Record<string, string> = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    INVITED: "Invited",
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    REVOKED: "Revoked",
    EXPIRED: "Expired",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${tone[status] ?? "bg-[#f2f2f2] text-[#333]"}`}
    >
      {label[status] ?? status}
    </span>
  );
}

export function TeamEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="py-8 text-center">
      <p className="m-0 text-[13px] font-semibold text-[#333]">{title}</p>
      {description ? (
        <p className="m-[4px_0_0] text-[12px] leading-[17px] text-[#777]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function TeamErrorState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[11px] border border-[#f3c9c9] bg-[#fff4f4] p-4">
      <p className="m-0 text-[13px] font-medium text-[#b42318]">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function TeamInfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[11px] leading-[16px] text-[#666]">{children}</p>
  );
}

/** Label used above a form control. */
export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-1.5 text-[12px] font-medium text-[#666]"
    >
      {children}
    </label>
  );
}

export const inputClass =
  "w-full h-[38px] px-4 border border-[#dedede] rounded-full bg-transparent text-[#171717] font-sans text-[13px] outline-none placeholder-[#929292] focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]";

export const selectClass =
  "w-full h-[38px] appearance-none pl-4 pr-10 border border-[#dedede] rounded-full bg-white text-[#171717] font-sans text-[13px] outline-none cursor-pointer focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]";

export const textareaClass =
  "w-full h-[96px] p-3.5 border border-[#dedede] rounded-[11px] bg-transparent text-[#171717] font-sans text-[13px] outline-none placeholder-[#929292] resize-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 h-[36px] px-4 border-0 rounded-full bg-[#171717] text-white font-sans text-[13px] font-medium cursor-pointer hover:bg-black transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed";

export const secondaryButtonClass =
  "h-[36px] px-4 border border-[#dedede] rounded-full text-[#666] bg-transparent font-sans font-medium text-[13px] cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export function formatTimestamp(value: string): string {
  return formatUtcTimestamp(value);
}
