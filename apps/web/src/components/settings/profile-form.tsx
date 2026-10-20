"use client";

import { useMemo, useState } from "react";
import { ProfileUserIcon } from "@/components/settings/icons";
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

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
};

function initials(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const localLetter = local.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "U";
  const domainLetter = domain.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "";
  return (localLetter + domainLetter).toUpperCase();
}

/**
 * The personal profile form.
 *
 * The values are loaded from the backend, validated before they are sent and
 * saved through the personal settings API.
 */
export function ProfileForm({ initial }: { initial: PersonalSettings | null }) {
  const { data, loading, error, reload, setData } = useResource<PersonalSettings>(
    getPersonalSettings,
    initial
  );

  const [fullName, setFullName] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const currentFullName = fullName ?? data?.full_name ?? "";
  const currentJobTitle = jobTitle ?? data?.job_title ?? "";
  const currentLanguage = language ?? data?.language ?? "en";

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      currentFullName !== data.full_name ||
      currentJobTitle !== data.job_title ||
      currentLanguage !== data.language
    );
  }, [data, currentFullName, currentJobTitle, currentLanguage]);

  useUnsavedChanges(dirty && !saving);

  if (loading) {
    return <SettingsSkeleton label="Loading your profile" />;
  }

  if (error && !data) {
    return (
      <div className="grid gap-4">
        <SettingsBanner tone="error" title="The profile could not be loaded">
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

  const supportedLanguages =
    (data?.supported?.languages as string[] | undefined) ?? ["en"];

  function discard() {
    setFullName(null);
    setJobTitle(null);
    setLanguage(null);
    setValidation(null);
    setMessage(null);
  }

  async function save() {
    if (!data) return;
    setValidation(null);
    setMessage(null);
    if (currentFullName.length > 150 || currentJobTitle.length > 150) {
      setValidation("The name and the job title can hold 150 characters each.");
      return;
    }
    setSaving(true);
    const result = await savePersonalSettings({
      full_name: currentFullName,
      job_title: currentJobTitle,
      language: currentLanguage,
    });
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setFullName(null);
      setJobTitle(null);
      setLanguage(null);
      setMessage({
        tone: "success",
        text: "Your profile was saved.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text: result.error ?? "Your profile could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      <SettingsCard
        title="Profile"
        description="How you appear to the other members of a workspace."
        chip={<SettingsChip>For you</SettingsChip>}
        bodyClassName=""
      >
        <div className="flex flex-wrap items-center gap-4 px-6 py-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f0f1ff] text-[15px] font-semibold text-[#7047ff]">
            {data?.email ? (
              initials(data.email)
            ) : (
              <ProfileUserIcon className="size-6 fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[14px] font-medium leading-[20px] text-[#171717]">
              {data?.full_name || "Your name"}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] leading-[18px] text-[#666]">
              {data?.email}
            </p>
          </div>
          <SettingsButton variant="secondary" disabled>
            Upload photo
          </SettingsButton>
        </div>
        <p className="m-0 border-t border-[#eeeeee] px-6 py-3 text-[12px] leading-[17px] text-[#666]">
          Profile images are not stored by the backend yet, so the initials of
          your email address are used instead.
        </p>
      </SettingsCard>

      <SettingsCard
        title="Details"
        description="The information the workspace shows about you."
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField label="Full name" htmlFor="fullname">
          <SettingsInput
            id="fullname"
            value={currentFullName}
            onChange={setFullName}
            placeholder="Your name"
            className="max-w-[420px]"
          />
        </SettingsField>

        <SettingsField
          label="Job title"
          htmlFor="jobtitle"
          description="Shown next to your name in the workspace."
        >
          <SettingsInput
            id="jobtitle"
            value={currentJobTitle}
            onChange={setJobTitle}
            placeholder="e.g. AI Engineer"
            className="max-w-[420px]"
          />
        </SettingsField>

        <SettingsField
          label="Preferred language"
          htmlFor="language"
          description="The language of the interface and of the emails."
        >
          <SettingsSelect
            id="language"
            value={currentLanguage}
            onChange={setLanguage}
            options={supportedLanguages.map((code) => ({
              value: code,
              label: LANGUAGE_LABELS[code] ?? code.toUpperCase(),
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Email address"
          htmlFor="email"
          description="The email address is managed by the account itself and cannot be changed here."
        >
          <SettingsInput
            id="email"
            type="email"
            value={data?.email ?? ""}
            disabled
            readOnly
            className="max-w-[420px]"
          />
        </SettingsField>
        </SettingsCard>

      {validation ? (
        <SettingsBanner tone="error" title="Check the form">
          {validation}
        </SettingsBanner>
      ) : null}

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
        saveLabel="Save profile"
      />
    </div>
  );
}
