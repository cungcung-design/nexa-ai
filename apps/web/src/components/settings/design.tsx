"use client";

import { useEffect, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/settings/icons";

/**
 * The design system of the settings screens.
 *
 * The screens follow the conventions of a production settings area: a page
 * header, cards that group related rows, a row per setting with the label on
 * the left and the control on the right, a sticky save bar and a danger zone
 * for the irreversible actions.
 *
 * The palette is the one of the settings dashboard: a near white page, a
 * #171717 text, a #dedede border, a muted #888 secondary text and the
 * #7047ff accent.
 */

export const settingsCardClass =
  "rounded-[14px] border border-[#dedede] bg-white";

export const settingsInputClass =
  "w-full h-9 px-3 rounded-lg border border-[#dedede] bg-white text-[13px] leading-[18px] text-[#171717] outline-none transition placeholder:text-[#666] focus:border-[#7047ff] focus:ring-[3px] focus:ring-[#7047ff]/12 disabled:cursor-not-allowed disabled:bg-[#f6f6f7] disabled:text-[#666]";

export const settingsSelectClass =
  "w-full h-9 appearance-none pl-3 pr-9 rounded-lg border border-[#dedede] bg-white text-[13px] leading-[18px] text-[#171717] outline-none transition focus:border-[#7047ff] focus:ring-[3px] focus:ring-[#7047ff]/12 disabled:cursor-not-allowed disabled:bg-[#f6f6f7] disabled:text-[#666]";

export const settingsLabelClass =
  "block text-[13px] font-medium leading-[18px] text-[#171717]";

export const settingsHintClass = "mt-1 text-[12px] leading-[17px] text-[#666]";

/**
 * The chip that marks the scope of a card: it tells the reader whether the
 * settings below belong to the account or to the workspace.
 */
export function SettingsChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f0f1ff] px-2 py-0.5 text-[11px] font-medium text-[#7047ff]">
      {children}
    </span>
  );
}

export function SettingsCard({
  title,
  description,
  icon,
  chip,
  footer,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  chip?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${settingsCardClass} overflow-hidden ${className}`}>
      {title ? (
        <header className="flex items-center justify-between border-b border-[#dedede] bg-[#fafafa] px-6 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span className="shrink-0 text-[#555] [&>svg]:h-4 [&>svg]:w-4">
                {icon}
              </span>
            ) : null}
            <h2 className="m-0 text-[14px] font-semibold text-[#171717]">
              {title}
            </h2>
            {chip}
          </div>
        </header>
      ) : null}
      {description ? (
        <p className="m-0 px-6 pt-3.5 pb-1 text-[12px] text-[#666]">
          {description}
        </p>
      ) : null}
      <div className={bodyClassName}>{children}</div>
      {footer ? (
        <footer className="flex items-center justify-end gap-2 border-t border-[#dedede] bg-[#fafafa] px-6 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/**
 * A single setting. The label and the explanation stay on the left and the
 * control is placed on the right, the way a production settings area does it.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  stacked = false,
  className = "",
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  if (stacked) {
    return (
      <div className={`px-6 py-3.5 ${className}`}>
        <label className={settingsLabelClass} htmlFor={htmlFor}>
          {label}
        </label>
        {description ? (
          <p className={settingsHintClass}>{description}</p>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${className}`}
    >
      <div className="min-w-0 sm:max-w-[62%]">
        <label className={settingsLabelClass} htmlFor={htmlFor}>
          {label}
        </label>
        {description ? (
          <p className={settingsHintClass}>{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="w-full shrink-0 sm:w-auto sm:min-w-[220px] sm:text-right">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A labelled control that is stacked under its label, used for the fields
 * that need the full width.
 */
export function SettingsField({
  label,
  description,
  htmlFor,
  children,
  className = "",
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 py-3.5 ${className}`}>
      <label className={settingsLabelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {description ? (
        <p className={settingsHintClass}>{description}</p>
      ) : null}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export function SettingsInput({
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  readOnly,
  autoComplete,
  min,
  max,
  step,
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange?.(event.target.value)}
      className={`${settingsInputClass} ${className}`}
    />
  );
}

export function SettingsSelect({
  id,
  value,
  onChange,
  options,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={settingsSelectClass}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#666]" />
    </div>
  );
}

/**
 * The toggle of a boolean setting.
 */
export function SettingsSwitch({
  id,
  checked,
  onChange,
  disabled,
  label,
  "aria-label": ariaLabel,
}: {
  id?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? "border-[#7047ff] bg-[#7047ff]"
          : "border-[#d4d4d4] bg-[#e8e8ea]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

const BANNER_TONES = {
  info: "border-[#e4defe] bg-[#f7f5ff] text-[#4a2fbf]",
  success: "border-[#cfe8cf] bg-[#f4faf4] text-[#217a37]",
  warning: "border-[#f5e2bd] bg-[#fdf8ec] text-[#8a5b12]",
  error: "border-[#f5cdcd] bg-[#fdf4f4] text-[#b42318]",
} as const;

export function SettingsBanner({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: keyof typeof BANNER_TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[10px] border px-4 py-3 text-[13px] leading-[19px] ${BANNER_TONES[tone]} ${className}`}
    >
      {title ? (
        <p className="m-0 font-semibold leading-[19px]">{title}</p>
      ) : null}
      {children ? (
        <div className={title ? "mt-1" : ""}>{children}</div>
      ) : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "border-[#dedede] bg-[#f6f6f7] text-[#555]",
  accent: "border-[#e6e0ff] bg-[#f0f1ff] text-[#7047ff]",
  success: "border-[#cfe8cf] bg-[#f4faf4] text-[#217a37]",
  danger: "border-[#f5cdcd] bg-[#fdf4f4] text-[#b42318]",
} as const;

export function SettingsBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-[16px] ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * The primary and the secondary action of a settings screen.
 */
export function SettingsButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary:
      "border border-transparent bg-[#7047ff] text-white hover:bg-[#5b32d6] disabled:bg-[#e9e9eb] disabled:text-[#a3a3a3]",
    secondary:
      "border border-[#dedede] bg-white text-[#374151] hover:bg-[#f7f7f8] disabled:text-[#a3a3a3] disabled:bg-[#fbfbfc]",
    danger:
      "border border-transparent bg-[#d92d20] text-white hover:bg-[#b42318] disabled:bg-[#f3c9c9] disabled:text-[#ffffff]",
    ghost:
      "border border-transparent bg-transparent text-[#666] hover:bg-[#f3f4f6] hover:text-[#171717] disabled:text-[#c4c4c8]",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The bar that keeps the pending changes and the save action in reach.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Save changes",
  discardLabel = "Discard",
  disabled,
  status,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  discardLabel?: string;
  disabled?: boolean;
  status?: ReactNode;
}) {
  return (
    <div
      className={`sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3 backdrop-blur transition-colors ${
        dirty
          ? "border-[#dedede] bg-white/95 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
          : "border-transparent bg-transparent"
      }`}
    >
      <p className="m-0 text-[12px] leading-[17px] text-[#666]">
        {status ?? (dirty ? "You have unsaved changes." : "Everything is saved.")}
      </p>
      <div className="flex items-center gap-2">
        {dirty && onDiscard ? (
          <SettingsButton
            variant="secondary"
            onClick={onDiscard}
            disabled={saving}
          >
            {discardLabel}
          </SettingsButton>
        ) : null}
        <SettingsButton
          onClick={onSave}
          disabled={!dirty || saving || disabled}
        >
          {saving ? "Saving…" : saveLabel}
        </SettingsButton>
      </div>
    </div>
  );
}

/**
 * The state of a screen that has nothing to show yet.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#dedede] bg-[#fcfcfc] px-6 py-10 text-center">
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full border border-[#ececec] bg-white text-[#666]">
          {icon}
        </span>
      ) : null}
      <p className="m-0 text-[14px] font-medium leading-[20px] text-[#171717]">
        {title}
      </p>
      {description ? (
        <p className="m-0 max-w-[46ch] text-[13px] leading-[19px] text-[#666]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * The loading state of a settings screen.
 */
export function SettingsSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[14px] border border-[#dedede] bg-white p-5"
    >
      <div className="h-3 w-40 rounded-full bg-[#f0f0f2]" />
      <div className="mt-4 h-9 w-full rounded-lg bg-[#f4f4f6]" />
      <div className="mt-3 h-9 w-2/3 rounded-lg bg-[#f4f4f6]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * The card of an irreversible action.
 */
export function DangerCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#f3cccc] bg-white">
      <header className="border-b border-[#f6dede] bg-[#fdf6f6] px-6 py-4">
        <h2 className="m-0 text-[14px] font-semibold leading-[20px] text-[#b42318]">
          {title}
        </h2>
        {description ? (
          <p className="m-0 mt-1 text-[12.5px] leading-[18px] text-[#666]">
            {description}
          </p>
        ) : null}
      </header>
      <div className="px-6 py-4">{children}</div>
    </section>
  );
}

/**
 * A chip that marks a value that is inherited instead of overridden.
 */
export function SourceChip({
  inherited,
  label,
}: {
  inherited: boolean;
  label?: string;
}) {
  return inherited ? (
    <SettingsBadge tone="neutral">{label ?? "Inherited"}</SettingsBadge>
  ) : (
    <SettingsBadge tone="accent">{label ?? "Overridden"}</SettingsBadge>
  );
}

/**
 * A readable list of the resolved values of a configuration.
 */
export function ConfigList({
  entries,
}: {
  entries: [string, ReactNode][];
}) {
  return (
    <dl className="m-0 divide-y divide-[#eeeeee]">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-wrap items-baseline justify-between gap-2 py-2"
        >
          <dt className="m-0 text-[12px] capitalize text-[#666]">
            {key.replace(/_/g, " ")}
          </dt>
          <dd className="m-0 text-[12px] text-[#171717]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Warns the user before a screen with unsaved changes is left.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
