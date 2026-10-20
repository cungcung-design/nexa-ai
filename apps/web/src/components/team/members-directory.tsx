"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MemberRowActions } from "@/components/team/member-row-actions";
import {
  Avatar,
  RoleBadge,
  StatusBadge,
  TeamEmptyState,
  formatTimestamp,
  inputClass,
  selectClass,
} from "@/components/team/shared";
import type { TeamMember } from "@/lib/api";

export function MembersDirectory({
  organizationId,
  members,
  roles,
  canManage,
  currentUserEmail,
}: {
  organizationId: string;
  members: TeamMember[];
  roles: { role: string; label: string }[];
  canManage: boolean;
  currentUserEmail: string;
}) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (role && member.role !== role) return false;
      if (status && member.status !== status) return false;
      if (!term) return true;
      return (
        member.email.toLowerCase().includes(term) ||
        member.role_label.toLowerCase().includes(term)
      );
    });
  }, [members, role, search, status]);

  const base = `/dashboard/organizations/${organizationId}/team`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email or role..."
          aria-label="Search members"
          className={inputClass}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-label="Filter by role"
          className={`${selectClass} sm:w-[170px]`}
        >
          <option value="">All roles</option>
          {roles.map((option) => (
            <option key={option.role} value={option.role}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className={`${selectClass} sm:w-[170px]`}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <TeamEmptyState
          title="No members match these filters"
          description="Clear the search or filters to see every workspace member."
        />
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-[#f0f0f0]">
          {filtered.map((member) => {
            const isSelf =
              currentUserEmail.length > 0 &&
              member.email.toLowerCase() === currentUserEmail.toLowerCase();
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <Avatar email={member.email} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`${base}/members/${member.id}`}
                      className="truncate text-[13px] font-medium text-[#171717] hover:underline"
                    >
                      {member.email}
                    </Link>
                    {isSelf ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f1f5ff] text-[#6366ff]">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 text-[11px] text-[#929292]">
                    Joined {formatTimestamp(member.created_at)}
                  </p>
                </div>
                <RoleBadge label={member.role_label} />
                <StatusBadge status={member.status} />
                <MemberRowActions
                  organizationId={organizationId}
                  membershipId={member.id}
                  email={member.email}
                  role={member.role}
                  status={member.status}
                  roles={roles}
                  canManage={canManage}
                  isSelf={isSelf}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="m-0 text-[12px] text-[#777]">
        Showing {filtered.length} of {members.length}{" "}
        {members.length === 1 ? "member" : "members"}.
      </p>
    </div>
  );
}
