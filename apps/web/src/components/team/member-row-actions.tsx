"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
} from "@/components/team/shared";

export type MemberRoleOption = { role: string; label: string };

async function readError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const detail =
      payload?.detail ?? payload?.error ?? payload?.message ?? undefined;
    if (typeof detail === "string" && detail.trim()) return detail;
  } catch {
    // The upstream did not return a JSON body.
  }
  return fallback;
}

export function MemberRowActions({
  organizationId,
  membershipId,
  email,
  role,
  status,
  roles,
  canManage,
  isSelf,
}: {
  organizationId: string;
  membershipId: string;
  email: string;
  role: string;
  status: string;
  roles: MemberRoleOption[];
  canManage: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const suspended = status !== "ACTIVE";

  async function update(payload: { role?: string; status?: string }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/team/members/${membershipId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        setError(
          await readError(response, "The membership could not be updated.")
        );
        return;
      }
      setOpen(false);
      setConfirmRemove(false);
      router.refresh();
    } catch {
      setError("The workspace could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${organizationId}/team/members/${membershipId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        setError(
          await readError(response, "The membership could not be removed.")
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("The workspace could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <span className="text-[12px] text-[#929292]">View only</span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError("");
          setConfirmRemove(false);
        }}
        className={secondaryButtonClass}
        aria-expanded={open}
      >
        Manage
      </button>

      {open ? (
        <div className="absolute right-0 top-[42px] z-20 w-[280px] p-4 border border-[#dedede] rounded-[13px] bg-white shadow-lg">
          <p className="m-0 text-[13px] font-semibold text-[#171717]">{email}</p>
          <p className="m-[2px_0_0] text-[11px] text-[#777]">
            {suspended
              ? "This membership is suspended and holds no permissions."
              : "Update the workspace role or the membership status."}
          </p>

          <label className="block mt-3">
            <span className="block mb-1.5 text-[12px] font-medium text-[#666]">
              Workspace role
            </span>
            <select
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value)}
              disabled={busy || isSelf}
              className={selectClass}
            >
              {roles.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => update({ role: nextRole })}
              disabled={busy || isSelf || nextRole === role}
              className={primaryButtonClass}
            >
              Save role
            </button>
            <button
              type="button"
              onClick={() =>
                update({ status: suspended ? "ACTIVE" : "SUSPENDED" })
              }
              disabled={busy || isSelf}
              className={secondaryButtonClass}
            >
              {suspended ? "Reactivate" : "Suspend"}
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
            {confirmRemove ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[#b42318]">
                  Remove this member from the workspace?
                </span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy || isSelf}
                  className="inline-flex items-center justify-center h-[32px] px-3 border-0 rounded-full bg-[#b42318] text-white font-sans text-[12px] font-medium cursor-pointer hover:bg-[#92140c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Confirm removal
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={busy}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={busy || isSelf}
                className="inline-flex items-center justify-center h-[32px] px-3 border border-[#f3c9c9] rounded-full bg-transparent text-[#b42318] font-sans text-[12px] font-medium cursor-pointer hover:bg-[#fff4f4] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Remove member
              </button>
            )}
          </div>

          {isSelf ? (
            <p className="m-[10px_0_0] text-[11px] text-[#929292]">
              You cannot change your own role, status or membership.
            </p>
          ) : null}

          {error ? (
            <p className="m-[10px_0_0] text-[12px] text-[#b42318]">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
