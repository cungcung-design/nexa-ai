import Link from "next/link";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { ChevronLeftIcon } from "@/components/settings/icons";
import { AUTH_ME_PATH, backendGet, type User } from "@/lib/api";

/**
 * The frame of the personal settings screens.
 *
 * The screen lives in the same card as the dashboard: a top bar with the
 * breadcrumb, the search and the account, the header of the screen and the
 * content itself.
 *
 * The top bar starts with the settings dashboard, so every screen of the area
 * is left with one click.
 */
export async function PersonalSettingsShell({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description?: string;
  breadcrumb?: string;
  children: React.ReactNode;
}) {
  const user = await backendGet<User>(AUTH_ME_PATH);

  return (
    <SettingsFrame
      breadcrumb={
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-[#777] font-medium leading-[16px]">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 text-[#777] transition-colors hover:text-[#171717]"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Settings
          </Link>
          <span className="text-[#dedede]" aria-hidden="true">
            /
          </span>
          <span className="text-[#171717]">{breadcrumb ?? title}</span>
        </p>
      }
      user={{ name: user?.full_name ?? null, email: user?.email ?? null }}
      title={title}
      description={description}
    >
      {children}
    </SettingsFrame>
  );
}
