import Link from "next/link";
import {
  Building2,
  LockKeyhole,
  Settings2,
  UserRound,
} from "lucide-react";
import {
  asArray,
  backendGet,
  AUTH_ME_PATH,
  ORGS_PATH,
  type Organization,
  type User,
} from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);
  const [rawOrganizations, user] = await Promise.all([
    backendGet<unknown>(ORGS_PATH),
    backendGet<User>(AUTH_ME_PATH),
  ]);
  const organizations = asArray<Organization>(rawOrganizations);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Workspace / Configuration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Review your current organization and account details.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-6">
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-violet-300" />
            <h2 className="text-lg font-semibold">Organization</h2>
          </div>
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-zinc-500">Workspace name</dt>
              <dd className="mt-1 font-medium">
                {org?.name ?? "No organization selected"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Organization ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-300">
                {org?.id ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Your role</dt>
              <dd className="mt-1 font-medium">{org?.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Memberships</dt>
              <dd className="mt-1 space-y-1">
                {organizations.map((o) => (
                  <p key={o.id} className="text-sm text-zinc-300">
                    {o.name} · {o.role}
                  </p>
                ))}
                {!organizations.length && (
                  <p className="text-zinc-500">None</p>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#14131e] p-6">
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-violet-300" />
            <h2 className="text-lg font-semibold">Account</h2>
          </div>
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-zinc-500">Name</dt>
              <dd className="mt-1 font-medium">
                {user?.full_name ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Email</dt>
              <dd className="mt-1 break-all font-medium">
                {user?.email ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Account ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-300">
                {user?.id ?? "Unavailable"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#14131e] p-6">
        <div className="flex items-center gap-3">
          <Settings2 className="size-5 text-violet-300" />
          <h2 className="text-lg font-semibold">Workspace configuration</h2>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Editing workspace details, member roles, invitations, API keys, and
          security policies requires dedicated backend routes with
          authorization, audit logging, and validation. This page displays
          real read-only settings rather than fake save buttons.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-4 text-sm text-zinc-300">
          <LockKeyhole className="size-5 shrink-0 text-violet-300" />
          Role management and security settings require backend endpoints that
          do not exist yet.
        </div>
        {org && (
          <Link
            className="mt-5 inline-flex rounded-xl border border-violet-500/30 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10"
            href={`/dashboard/organizations/${encodeURIComponent(org.id)}/billing`}
          >
            View subscription settings →
          </Link>
        )}
      </section>
    </div>
  );
}
