"use client";

import { useMemo, useState } from "react";
import {
  AgentIcon,
  ApprovalIcon,
  BellIcon,
  BillingIcon,
  LockIcon,
  SecurityIcon,
  WorkflowIcon,
} from "@/components/settings/icons";
import {
  SaveBar,
  SettingsBadge,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsRow,
  SettingsSkeleton,
  SettingsSwitch,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  getPersonalSettings,
  saveNotificationPreferences,
  type NotificationPreferences,
  type PersonalSettings,
} from "@/lib/api/settings";

const TYPE_ROWS: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "approvals",
    title: "Approval requests",
    description: "New assignments and urgent review requests",
    icon: <ApprovalIcon className="size-4 shrink-0" />,
  },
  {
    key: "workflow_failures",
    title: "Workflow failures",
    description: "Failed executions and important workflow events",
    icon: <WorkflowIcon className="size-4 shrink-0" />,
  },
  {
    key: "agent_alerts",
    title: "AI agent alerts",
    description: "Agent errors and deployment events",
    icon: <AgentIcon className="size-4 shrink-0" />,
  },
  {
    key: "security_alerts",
    title: "Security alerts",
    description: "Important account and workspace security events",
    icon: <SecurityIcon className="size-4 shrink-0" />,
  },
  {
    key: "billing_updates",
    title: "Billing updates",
    description: "Invoices, payment failures and subscription changes",
    icon: <BillingIcon className="size-4 shrink-0" />,
  },
];

const CHANNEL_ROWS: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}[] = [
  {
    key: "email_channel",
    title: "Email",
    description: "Send the notification to the address of your account",
  },
  {
    key: "in_app_channel",
    title: "In app",
    description: "Show the notification inside Nexa AI",
  },
];

/**
 * The personal notification preferences.
 *
 * Mandatory workspace notifications stay enabled and cannot be switched off
 * from the personal preferences.
 */
export function NotificationPreferencesForm({
  initial,
}: {
  initial: PersonalSettings | null;
}) {
  const { data, loading, error, reload, setData } = useResource<PersonalSettings>(
    getPersonalSettings,
    initial
  );

  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const values = draft ?? data?.notifications ?? null;
  const mandatory = data?.mandatory_notifications ?? ["security_alerts"];

  const dirty = useMemo(() => {
    if (!data || !values) return false;
    return JSON.stringify(values) !== JSON.stringify(data.notifications);
  }, [data, values]);

  if (loading) {
    return <SettingsSkeleton label="Loading your notification preferences" />;
  }

  if (error && !data) {
    return (
      <div className="grid gap-4">
        <SettingsBanner
          tone="error"
          title="The notification preferences could not be loaded"
        >
          {error}
        </SettingsBanner>
        <div>
          <SettingsButton variant="secondary" onClick={() => void reload()}>
            Try again
          </SettingsButton>
        </div>
      </div>
    );
  }

  function update(key: keyof NotificationPreferences, value: boolean) {
    if (!values) return;
    setDraft({ ...values, [key]: value });
    setMessage(null);
  }

  async function save() {
    if (!values) return;
    setSaving(true);
    setMessage(null);
    const result = await saveNotificationPreferences(values);
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setDraft(null);
      setMessage({
        tone: "success",
        text: "Your notification preferences were saved.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text:
        result.error ?? "Your notification preferences could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      <SettingsCard
        title="What you get notified about"
        description="The events of your workspaces that deserve your attention."
        chip={<SettingsChip>For you</SettingsChip>}
        bodyClassName="divide-y divide-[#eeeeee]"
      >
          {TYPE_ROWS.map((row) => {
            const locked = mandatory.includes(row.key);
            return (
              <SettingsRow
              key={row.key}
              label={
                <span className="flex items-center gap-2.5">
                  <span className="text-[#666]">{row.icon}</span>
                  {row.title}
                  {locked ? (
                    <SettingsBadge tone="accent">
                      <LockIcon className="mr-1 inline size-3" />
                      Required
                    </SettingsBadge>
                  ) : null}
                </span>
              }
              description={
                locked
                  ? `${row.description}. This notification is mandatory for the workspace.`
                  : row.description
              }
              htmlFor={`notification-${row.key}`}
            >
              <SettingsSwitch
                id={`notification-${row.key}`}
                label={row.title}
                checked={values ? values[row.key] : false}
                disabled={locked}
                onChange={(checked) => update(row.key, checked)}
              />
            </SettingsRow>
          );
        })}
      </SettingsCard>

    <SettingsCard
      title="Delivery channels"
      description="Where the notifications are delivered."
      bodyClassName="divide-y divide-[#eeeeee]"
    >
        {CHANNEL_ROWS.map((row) => (
          <SettingsRow
            key={row.key}
            label={
              <span className="flex items-center gap-2.5">
                <span className="text-[#666]">
                  <BellIcon className="size-4 shrink-0" />
                </span>
                {row.title}
              </span>
            }
            description={row.description}
            htmlFor={`notification-${row.key}`}
          >
            <SettingsSwitch
              id={`notification-${row.key}`}
              label={row.title}
              checked={values ? values[row.key] : false}
              onChange={(checked) => update(row.key, checked)}
            />
          </SettingsRow>
        ))}
      </SettingsCard>

    {message ? (
      <SettingsBanner
          tone={message.tone === "success" ? "success" : "error"}
        >
          {message.text}
        </SettingsBanner>
      ) : null}

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(null);
          setMessage(null);
        }}
        saveLabel="Save notifications"
      />
    </div>
  );
}
