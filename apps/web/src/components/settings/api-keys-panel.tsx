"use client";

import { useState } from "react";
import { KeyIcon } from "@/components/settings/icons";
import {
  EmptyState,
  SettingsBadge,
  SettingsBanner,
  SettingsButton,
  SettingsCard,
  SettingsChip,
  SettingsField,
  SettingsInput,
  SettingsSkeleton,
} from "@/components/settings/design";
import { useResource } from "@/components/settings/use-resource";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/lib/api/settings";

const SCOPES = [
  { value: "agent:read", label: "Read agents" },
  { value: "agent:invoke", label: "Run agents" },
];

function maskKey(keyPrefix: string): string {
  const tail = keyPrefix.slice(-4).toUpperCase();
  return `nexa_••••••••••${tail}`;
}

/**
 * The API keys of the workspace.
 *
 * A new secret is only shown once, right after it was created or rotated.
 * The list only ever shows the masked identifier.
 */
export function ApiKeysPanel({ organizationId }: { organizationId: string }) {
  const { data, loading, error, reload } = useResource<ApiKey[]>(
    () => listApiKeys(organizationId),
    null
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["agent:read"]);
  const [secret, setSecret] = useState<CreatedApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function create() {
    setMessage(null);
    if (name.trim().length < 2) {
      setMessage({
        tone: "error",
        text: "The key needs a name of at least two characters.",
      });
      return;
    }
    if (!scopes.length) {
      setMessage({
        tone: "error",
        text: "Select at least one capability.",
      });
      return;
    }
    setBusy(true);
    const result = await createApiKey(organizationId, {
      name: name.trim(),
      scopes,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setMessage({
        tone: "error",
        text: result.error ?? "The key could not be created.",
      });
      return;
    }
    setSecret(result.data);
    setName("");
    setCreating(false);
    await reload();
  }

  async function rotate(key: ApiKey) {
    setMessage(null);
    setBusy(true);
    const result = await rotateApiKey(organizationId, key.id);
    setBusy(false);
    if (!result.ok || !result.data) {
      setMessage({
        tone: "error",
        text: result.error ?? "The key could not be rotated.",
      });
      return;
    }
    setSecret(result.data);
    setMessage({
      tone: "success",
      text: `“${key.name}” was rotated. The previous key stopped working immediately.`,
    });
    await reload();
  }

  async function revoke(key: ApiKey) {
    setMessage(null);
    setBusy(true);
    const result = await revokeApiKey(organizationId, key.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text: result.error ?? "The key could not be revoked.",
      });
      return;
    }
    setMessage({
      tone: "success",
      text: `“${key.name}” was revoked. Requests with this key are rejected now.`,
    });
    await reload();
  }

  return (
    <div className="grid gap-4">
      {creating ? (
        <SettingsCard
          title="Create a new key"
          description="Give the key a name that says where it is used."
          bodyClassName=""
          footer={
            <>
              <SettingsButton
                variant="secondary"
                onClick={() => setCreating(false)}
                disabled={busy}
              >
                Cancel
              </SettingsButton>
              <SettingsButton onClick={() => void create()} disabled={busy}>
                {busy ? "Creating…" : "Create key"}
              </SettingsButton>
            </>
          }
        >
          <SettingsField label="Key name" htmlFor="key-name">
            <SettingsInput
              id="key-name"
              value={name}
              onChange={setName}
              placeholder="Production API Key"
              className="max-w-[420px]"
            />
          </SettingsField>

          <SettingsField
            label="Capabilities"
            htmlFor="key-scopes"
            description="The key may only do what it is scoped for."
          >
            <div id="key-scopes" className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => {
                const selected = scopes.includes(scope.value);
                return (
                  <button
                    key={scope.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setScopes(
                        selected
                          ? scopes.filter((item) => item !== scope.value)
                          : [...scopes, scope.value]
                      )
                    }
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                      selected
                        ? "border-[#7047ff] bg-[#f0f1ff] text-[#7047ff]"
                        : "border-[#dedede] bg-white text-[#666]"
                    }`}
                  >
                    {scope.label}
                  </button>
                );
              })}
            </div>
          </SettingsField>
        </SettingsCard>
      ) : null}

      {secret ? (
        <SettingsBanner tone="success" title="Copy the secret now">
          <p className="m-0 mt-1 font-mono text-[12px] break-all text-[#171717]">
            {secret.api_key}
          </p>
          <div className="mt-2">
            <SettingsButton
              variant="secondary"
              onClick={() => setSecret(null)}
            >
              Hide secret
            </SettingsButton>
          </div>
        </SettingsBanner>
      ) : null}

      {message ? (
        <SettingsBanner
          tone={message.tone === "success" ? "success" : "error"}
        >
          {message.text}
        </SettingsBanner>
      ) : null}

      {error ? (
        <SettingsBanner tone="error" title="The keys could not be loaded">
          {error}
        </SettingsBanner>
      ) : null}

      {loading ? <SettingsSkeleton label="Loading the API keys" /> : null}

      <SettingsCard
        icon={<KeyIcon className="size-4" />}
        title="API keys"
        chip={<SettingsChip>For your team</SettingsChip>}
        description="A secret is revealed only once, right after it was created or rotated."
        bodyClassName="divide-y divide-[#eeeeee]"
      >
        {data && data.length === 0 ? (
          <div className="px-6 py-4">
            <EmptyState
              title="No API key yet"
              description="Create a key to let a service call the agents of this workspace."
            />
          </div>
        ) : null}

        {(data ?? []).map((key) => (
          <div key={key.id} className="px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[14px] font-medium leading-[20px] text-[#171717]">
                  {key.name}
                </p>
                <p className="m-0 mt-1 font-mono text-[12px] text-[#666]">
                  {maskKey(key.key_prefix)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SettingsBadge tone={key.is_active ? "success" : "danger"}>
                  {key.is_active ? "Active" : "Revoked"}
                </SettingsBadge>
              </div>
            </div>

            <p className="m-0 mt-2 text-[12px] text-[#666]">
              {(key.scopes ?? []).join(", ") || "No capabilities"}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <SettingsButton
                variant="secondary"
                onClick={() => void rotate(key)}
                disabled={busy}
              >
                Rotate
              </SettingsButton>
              <SettingsButton
                variant="secondary"
                onClick={() => void revoke(key)}
                disabled={busy}
              >
                Revoke
              </SettingsButton>
            </div>
          </div>
        ))}
      </SettingsCard>

      <p className="m-0 text-[12px] leading-[17px] text-[#666]">
        Rotating revokes the previous key immediately, so there is no overlap
        period. A revoked key is rejected on the next request.
      </p>
    </div>
  );
}
