"use client";

import { useMemo, useState } from "react";
import {
  SaveBar,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsSkeleton,
  useUnsavedChanges,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  getPersonalSettings,
  savePersonalSettings,
  type PersonalSettings,
} from "@/lib/api/settings";

const APPEARANCE_LABELS: Record<string, string> = {
  system: "Match the system",
  light: "Light",
  dark: "Dark",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
};

/**
 * The personal preferences of the signed in account.
 */
export function PreferencesForm({
  initial,
}: {
  initial: PersonalSettings | null;
}) {
  const { data, loading, error, reload, setData } = useResource<PersonalSettings>(
    getPersonalSettings,
    initial
  );

  const [appearance, setAppearance] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const currentAppearance = appearance ?? data?.appearance ?? "system";
  const currentLanguage = language ?? data?.language ?? "en";
  const currentTimezone = timezone ?? data?.timezone ?? "UTC";

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      currentAppearance !== data.appearance ||
      currentLanguage !== data.language ||
      currentTimezone !== data.timezone
    );
  }, [data, currentAppearance, currentLanguage, currentTimezone]);

  useUnsavedChanges(dirty && !saving);

  if (loading) {
    return <SettingsSkeleton label="Loading your preferences" />;
  }

  if (error && !data) {
    return (
      <div className="grid gap-4">
        <SettingsBanner tone="error" title="The preferences could not be loaded">
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

  const appearances =
    (data?.supported?.appearances as string[] | undefined) ?? ["system"];
  const languages =
    (data?.supported?.languages as string[] | undefined) ?? ["en"];

  function discard() {
    setAppearance(null);
    setLanguage(null);
    setTimezone(null);
    setMessage(null);
  }

  async function save() {
    if (!data) return;
    setMessage(null);
    setSaving(true);
    const result = await savePersonalSettings({
      appearance: currentAppearance,
      language: currentLanguage,
      timezone: currentTimezone.trim() || "UTC",
    });
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setAppearance(null);
      setLanguage(null);
      setTimezone(null);
      setMessage({ tone: "success", text: "Your preferences were saved." });
      return;
    }
    setMessage({
      tone: "error",
      text: result.error ?? "Your preferences could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      <SettingsCard
        title="Interface"
        description="How Nexa AI looks and reads in this browser."
        chip={<SettingsChip>For you</SettingsChip>}
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField
          label="Appearance"
          htmlFor="appearance"
          description="The colour scheme of the dashboard."
        >
          <SettingsSelect
            id="appearance"
            value={currentAppearance}
            onChange={setAppearance}
            options={appearances.map((value) => ({
              value,
              label: APPEARANCE_LABELS[value] ?? value,
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Language"
          htmlFor="preferences-language"
          description="The language of the dashboard and of the emails."
        >
          <SettingsSelect
            id="preferences-language"
            value={currentLanguage}
            onChange={setLanguage}
            options={languages.map((code) => ({
              value: code,
              label: LANGUAGE_LABELS[code] ?? code.toUpperCase(),
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Timezone"
          htmlFor="timezone"
          description="Used to render the timestamps of the audit log and of the usage charts."
        >
          <SettingsInput
            id="timezone"
            value={currentTimezone}
            onChange={setTimezone}
            placeholder="UTC"
            className="max-w-[420px]"
          />
        </SettingsField>
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
        onDiscard={discard}
        saveLabel="Save preferences"
      />
    </div>
  );
}
