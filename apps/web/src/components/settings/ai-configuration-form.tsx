"use client";

import { useMemo, useState } from "react";
import { BrainIcon } from "@/components/settings/icons";
import {
  SaveBar,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSelect,
  SettingsSkeleton,
  SettingsSwitch,
  useUnsavedChanges,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/api/settings";

const APPROVAL_POLICY_LABELS: Record<string, string> = {
  require: "Require approval",
  optional: "Ask when it matters",
  disabled: "Never ask",
};

const CAPTURE_LABELS: Record<string, string> = {
  dynamic: "Resolve when a run starts",
  snapshot: "Capture when a version is published",
};

/**
 * The AI configuration of the workspace.
 *
 * The values are the defaults every agent inherits unless the agent, the
 * workflow or the run overrides them.
 */
export function AiConfigurationForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: WorkspaceSettings | null;
}) {
  const { data, loading, error, reload, setData } =
    useResource<WorkspaceSettings>(
      () => getWorkspaceSettings(organizationId),
      initial
    );

  const [model, setModel] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<string | null>(null);
  const [timeout, setTimeout] = useState<string | null>(null);
  const [policy, setPolicy] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const currentModel = model ?? data?.ai.default_model ?? "";
  const currentTemperature =
    temperature ??
    (data?.ai.default_temperature !== null &&
    data?.ai.default_temperature !== undefined
      ? String(data.ai.default_temperature)
      : "");
  const currentTimeout =
    timeout ??
    (data?.ai.default_agent_timeout_seconds !== null &&
    data?.ai.default_agent_timeout_seconds !== undefined
      ? String(data.ai.default_agent_timeout_seconds)
      : "");
  const currentPolicy = policy ?? data?.ai.default_tool_approval_policy ?? "";
  const currentCaptureMode = captureMode ?? data?.ai.capture_mode ?? "dynamic";
  const currentAllowed = allowed ?? data?.ai.allowed_models ?? [];
  const currentRequireApproval =
    requireApproval ?? data?.ai.require_tool_approval ?? false;

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      currentModel !== (data.ai.default_model ?? "") ||
      currentTemperature !==
        (data.ai.default_temperature !== null &&
        data.ai.default_temperature !== undefined
          ? String(data.ai.default_temperature)
          : "") ||
      currentTimeout !==
        (data.ai.default_agent_timeout_seconds !== null &&
        data.ai.default_agent_timeout_seconds !== undefined
          ? String(data.ai.default_agent_timeout_seconds)
          : "") ||
      currentPolicy !== (data.ai.default_tool_approval_policy ?? "") ||
      currentCaptureMode !== data.ai.capture_mode ||
      JSON.stringify(currentAllowed) !== JSON.stringify(data.ai.allowed_models) ||
      currentRequireApproval !== data.ai.require_tool_approval
    );
  }, [
    data,
    currentModel,
    currentTemperature,
    currentTimeout,
    currentPolicy,
    currentCaptureMode,
    currentAllowed,
    currentRequireApproval,
  ]);

  useUnsavedChanges(dirty && !saving);

  if (loading) {
    return <SettingsSkeleton label="Loading the AI configuration" />;
  }

  if (error && !data) {
    return (
      <div className="grid gap-4">
        <SettingsBanner
          tone="error"
          title="The configuration could not be loaded"
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

  const canManage = data?.can_manage ?? false;
  const models = data?.ai.available_models ?? [];

  function discard() {
    setModel(null);
    setTemperature(null);
    setTimeout(null);
    setPolicy(null);
    setCaptureMode(null);
    setAllowed(null);
    setRequireApproval(null);
    setValidation(null);
    setMessage(null);
  }

  async function save() {
    if (!data) return;
    setMessage(null);
    setValidation(null);

    const parsedTemperature =
      currentTemperature.trim() === ""
        ? null
        : Number(currentTemperature);
    if (
      parsedTemperature !== null &&
      (Number.isNaN(parsedTemperature) ||
        parsedTemperature < 0 ||
        parsedTemperature > 2)
    ) {
      setValidation("The temperature has to be between 0 and 2.");
      return;
    }
    const parsedTimeout =
      currentTimeout.trim() === "" ? null : Number(currentTimeout);
    if (
      parsedTimeout !== null &&
      (Number.isNaN(parsedTimeout) ||
        parsedTimeout < 5 ||
        parsedTimeout > 3600)
    ) {
      setValidation("The agent timeout has to be between 5 and 3600 seconds.");
      return;
    }

    setSaving(true);
    const result = await saveWorkspaceSettings(organizationId, {
      ai: {
        default_model: currentModel.trim() ? currentModel.trim() : null,
        default_temperature: parsedTemperature,
        default_agent_timeout_seconds: parsedTimeout,
        default_tool_approval_policy: currentPolicy.trim()
          ? currentPolicy.trim()
          : null,
        allowed_models: currentAllowed,
        require_tool_approval: currentRequireApproval,
        capture_mode: currentCaptureMode,
      },
    });
    setSaving(false);
    if (result.ok && result.data) {
      setData(result.data);
      setModel(null);
      setTemperature(null);
      setTimeout(null);
      setPolicy(null);
      setCaptureMode(null);
      setAllowed(null);
      setRequireApproval(null);
      setMessage({
        tone: "success",
        text: "The AI configuration was saved.",
      });
      return;
    }
    setMessage({
      tone: "error",
      text:
        result.error ?? "The AI configuration could not be saved.",
    });
  }

  return (
    <div className="grid gap-4">
      {!canManage ? (
        <SettingsBanner tone="warning" title="Read only">
          Your role cannot change the AI configuration of the workspace.
        </SettingsBanner>
      ) : null}

      <SettingsCard
        icon={<BrainIcon className="size-4" />}
        title="Model defaults"
        chip={<SettingsChip>For your team</SettingsChip>}
        description="The model and the parameters a run uses when nothing overrides them."
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField
          label="Default model"
          htmlFor="model"
          description="The model of the run when the agent does not choose one."
        >
          <SettingsSelect
            id="model"
            value={currentModel}
            disabled={!canManage}
            onChange={setModel}
            className="max-w-[420px]"
            options={[
              { value: "", label: "Use the model of the agent" },
              ...models.map((value) => ({ value, label: value })),
            ]}
          />
        </SettingsField>

        <SettingsField
          label="Default temperature"
          htmlFor="temperature"
          description="The generation temperature where the selected model supports it."
        >
          <SettingsInput
            id="temperature"
            type="number"
            min={0}
            max={2}
            step={0.1}
            placeholder="Inherit from the agent"
            value={currentTemperature}
            disabled={!canManage}
            onChange={setTemperature}
            className="max-w-[220px]"
          />
        </SettingsField>

        <SettingsField
          label="Default agent timeout"
          htmlFor="timeout"
          description="How long a single agent run may take."
        >
          <SettingsInput
            id="timeout"
            type="number"
            min={5}
            max={3600}
            placeholder="Timeout in seconds"
            value={currentTimeout}
            disabled={!canManage}
            onChange={setTimeout}
            className="max-w-[220px]"
          />
        </SettingsField>

        <SettingsField
          label="Default tool approval policy"
          htmlFor="approval-policy"
          description="When an agent has to ask before it calls a tool."
        >
          <SettingsSelect
            id="approval-policy"
            value={currentPolicy}
            disabled={!canManage}
            onChange={setPolicy}
            className="max-w-[420px]"
            options={[
              { value: "", label: "Follow the agent configuration" },
              ...(data?.ai.tool_approval_policies ?? []).map((value) => ({
                value,
                label: APPROVAL_POLICY_LABELS[value] ?? value,
              })),
            ]}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsCard
        title="Inheritance"
        description="How the defaults reach the agents and what a run is allowed to change."
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        <SettingsField
          label="Resolution of the defaults"
          htmlFor="capture-mode"
          description={
            currentCaptureMode === "snapshot"
              ? "The defaults are captured when an agent version is published. Later changes do not affect the published version."
              : "The defaults are resolved when a run starts. A published version keeps the values it was created with until it is published again."
          }
        >
          <SettingsSelect
            id="capture-mode"
            value={currentCaptureMode}
            disabled={!canManage}
            onChange={setCaptureMode}
            className="max-w-[420px]"
            options={(data?.ai.capture_modes ?? ["dynamic"]).map((value) => ({
              value,
              label: CAPTURE_LABELS[value] ?? value,
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Allowed models"
          htmlFor="allowed-models"
          description={
            currentAllowed.length
              ? "Only these models may be used. An override that selects another model is rejected."
              : "Every model the backend supports may be used."
          }
        >
          <div className="flex flex-wrap gap-2">
            {models.map((value) => {
              const selected = currentAllowed.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!canManage}
                  aria-pressed={selected}
                  onClick={() =>
                    setAllowed(
                      selected
                        ? currentAllowed.filter((item) => item !== value)
                        : [...currentAllowed, value]
                    )
                  }
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                    selected
                      ? "border-[#7047ff] bg-[#f0f1ff] text-[#7047ff]"
                      : "border-[#dedede] bg-white text-[#666]"
                  } ${canManage ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </SettingsField>

        <SettingsRow
          label="Require approval for every tool call"
          description="A mandatory workspace policy. An agent, a workflow or a run cannot weaken it."
          htmlFor="require-approval"
        >
          <SettingsSwitch
            id="require-approval"
            label="Require approval for every tool call"
            checked={currentRequireApproval}
            disabled={!canManage}
            onChange={setRequireApproval}
          />
        </SettingsRow>
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
        disabled={!canManage}
        onSave={() => void save()}
        onDiscard={discard}
        saveLabel="Save AI configuration"
      />

      <p className="m-0 text-[12px] leading-[17px] text-[#666]">
        The models, the parameter ranges and the policies come from the
        backend. The resolved configuration is stored with every run.
      </p>
    </div>
  );
}
