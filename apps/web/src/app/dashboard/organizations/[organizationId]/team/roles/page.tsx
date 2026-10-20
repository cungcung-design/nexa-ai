import {
  TeamCard,
  TeamEmptyState,
  TeamFooterNote,
} from "@/components/team/shared";
import { ShieldCheckIcon } from "@/components/team/icons";
import { teamMatrix, teamRoles } from "@/lib/api";
import { authorizedOrganization } from "@/lib/workspace";

export default async function TeamRolesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = await authorizedOrganization(organizationId);

  if (!org) {
    return (
      <TeamCard>
        <TeamEmptyState
          title="No workspace selected"
          description="Choose an organization to review its roles."
        />
      </TeamCard>
    );
  }

  const [roles, matrix] = await Promise.all([
    teamRoles(org.id),
    teamMatrix(org.id),
  ]);

  const columns = matrix?.roles ?? [];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {roles.map((role) => (
          <TeamCard key={role.role}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold text-[#171717]">
                <span className="text-[#6366f1]">
                  <ShieldCheckIcon size={16} />
                </span>
                {role.label}
              </h2>
              <span className="text-[12px] text-[#777]">
                {role.member_count}{" "}
                {role.member_count === 1 ? "member" : "members"}
              </span>
            </div>
            <p className="m-[6px_0_0] text-[12px] leading-[17px] text-[#777]">
              {role.description}
            </p>
            <ul className="m-[10px_0_0] p-0 list-none space-y-1">
              {role.permission_labels.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-[12px] text-[#444]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                  {label}
                </li>
              ))}
            </ul>
          </TeamCard>
        ))}
      </section>

      <TeamCard wide>
        <h2 className="m-0 text-[15px] font-semibold text-[#171717]">
          Permission Matrix
        </h2>
        <p className="m-[2px_0_0] text-[12px] text-[#777]">
          Every capability maps to a backend permission, so the matrix always
          matches what the API enforces.
        </p>

        {!matrix || columns.length === 0 ? (
          <TeamEmptyState
            title="No permission data"
            description="The workspace role matrix could not be loaded."
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#dedede]">
                  <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-[#777]">
                    Capability
                  </th>
                  {columns.map((role) => (
                    <th
                      key={role}
                      className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#777] whitespace-nowrap"
                    >
                      {matrix.role_labels[role] ?? role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.capabilities.map((capability) => (
                  <tr key={capability.capability} className="border-b border-[#f0f0f0]">
                    <td className="py-2.5 pr-3 text-[13px] text-[#171717]">
                      {capability.capability}
                      <span className="block text-[11px] text-[#929292]">
                        {capability.permission}
                      </span>
                    </td>
                    {columns.map((role) => (
                      <td key={role} className="px-3 py-2.5">
                        {capability.grants[role] ? (
                          <span
                            aria-label="Granted"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#e0f2df] text-[#28a745] text-[11px] font-bold"
                          >
                            &#10003;
                          </span>
                        ) : (
                          <span
                            aria-label="Not granted"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#f4f4f4] text-[#b0b0b0] text-[11px] font-bold"
                          >
                            &ndash;
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TeamFooterNote>
          The workspace role is the only permission source in this release.
          Group membership and per member direct resource grants are not
          implemented yet.
        </TeamFooterNote>
      </TeamCard>
    </div>
  );
}
