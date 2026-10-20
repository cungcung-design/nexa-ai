"""Settings services: validation and AI configuration inheritance.

The inheritance chain for every overridable setting is::

    permitted run override
        -> workflow override
        -> agent override (stored for the selected agent version)
        -> workspace default
        -> agent version baseline (model and temperature only)
        -> backend default

Workspace policies are mandatory: the model restriction and the tool
approval requirement are applied on top of the resolved value and can never
be weakened by an agent, workflow or run override.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Agent, AgentVersion
from app.modules.settings.models import (
    AgentConfigOverride,
    RunConfigSnapshot,
    UserSettings,
    WorkflowConfigOverride,
    WorkspaceSettings,
)

#: Settings that may be overridden and the order in which the sources are
#: consulted. The agent version baseline is the fallback for the two
#: settings an agent version has always owned.
OVERRIDABLE_SETTINGS = (
    "model",
    "temperature",
    "agent_timeout_seconds",
    "tool_approval_policy",
)

SOURCE_LABELS = {
    "run_override": "Run override",
    "workflow_override": "Workflow override",
    "agent_override": "Agent override",
    "workspace_default": "Workspace default",
    "agent_version": "Agent configuration",
    "server_default": "Backend default",
}

#: Allowed values for the tool approval policy.
TOOL_APPROVAL_POLICIES = ("require", "optional", "disabled")

#: Allowed values for the AI configuration capture mode.
AI_CAPTURE_MODES = ("dynamic", "snapshot")

#: Backend supported ranges.
TEMPERATURE_MIN = 0.0
TEMPERATURE_MAX = 2.0
TIMEOUT_MIN = 5
TIMEOUT_MAX = 3600
RETENTION_MIN = 1
RETENTION_MAX = 3650
SESSION_TIMEOUT_MIN = 5
SESSION_TIMEOUT_MAX = 10080

#: Personal preferences the backend stores.
LANGUAGES = ("en", "es", "fr", "de")
APPEARANCES = ("system", "light", "dark")

#: Notification preferences. The key is the stored column suffix.
NOTIFICATION_PREFERENCES = (
    "approvals",
    "workflow_failures",
    "agent_alerts",
    "security_alerts",
    "billing_updates",
)

#: Notification channels the backend can record.
NOTIFICATION_CHANNELS = ("email", "in_app")

#: Notifications the workspace policy makes mandatory. A user may not turn
#: these off from the personal preferences.
MANDATORY_NOTIFICATIONS = ("security_alerts",)


class SettingsValidationError(ValueError):
    """Raised when a settings value is not supported by the backend."""


# --- Personal settings ------------------------------------------------------


def get_or_create_user_settings(db: Session, user_id: UUID) -> UserSettings:
    """Return the personal settings of a user, creating them on first use."""
    settings_row = db.scalar(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    if settings_row is not None:
        return settings_row
    settings_row = UserSettings(user_id=user_id)
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


# --- Workspace settings -----------------------------------------------------


def get_or_create_workspace_settings(
    db: Session, organization_id: UUID
) -> WorkspaceSettings:
    """Return the workspace settings, creating them on first use."""
    row = db.scalar(
        select(WorkspaceSettings).where(
            WorkspaceSettings.organization_id == organization_id
        )
    )
    if row is not None:
        return row
    row = WorkspaceSettings(organization_id=organization_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def supported_models(db: Session, organization_id: UUID) -> list[str]:
    """Models the backend can actually run for this workspace.

    The list is built from the configured backend model plus the models the
    workspace already uses, so the UI never offers a model the backend
    cannot serve.
    """
    models: list[str] = []
    configured = (settings.llm_default_model or "").strip()
    if configured:
        models.append(configured)
    for model in (settings.llm_available_models or "").split(","):
        cleaned = model.strip()
        if cleaned and cleaned not in models:
            models.append(cleaned)
    used = db.scalars(
        select(AgentVersion.model)
        .join(
            Agent,
            Agent.id == AgentVersion.agent_id,
        )
        .where(Agent.organization_id == organization_id)
        .distinct()
    ).all()
    for model in used:
        if model and model not in models:
            models.append(model)
    return models


def validate_model(
    db: Session, organization_id: UUID, model: str | None
) -> str | None:
    """Validate a model name against the backend and the workspace policy."""
    if model is None:
        return None
    cleaned = model.strip()
    if not cleaned:
        return None
    if len(cleaned) > 100:
        raise SettingsValidationError("Model name is too long")
    supported = supported_models(db, organization_id)
    if supported and cleaned not in supported:
        raise SettingsValidationError(
            f"Model “{cleaned}” is not supported by this backend"
        )
    workspace = get_or_create_workspace_settings(db, organization_id)
    allowed = list(workspace.allowed_models or [])
    if allowed and cleaned not in allowed:
        raise SettingsValidationError(
            f"Model “{cleaned}” is not allowed by the workspace policy"
        )
    return cleaned


def validate_temperature(value: float | None) -> float | None:
    if value is None:
        return None
    if not TEMPERATURE_MIN <= value <= TEMPERATURE_MAX:
        raise SettingsValidationError(
            f"Temperature must be between {TEMPERATURE_MIN} and "
            f"{TEMPERATURE_MAX}"
        )
    return value


def validate_timeout(value: int | None) -> int | None:
    if value is None:
        return None
    if not TIMEOUT_MIN <= value <= TIMEOUT_MAX:
        raise SettingsValidationError(
            f"Agent timeout must be between {TIMEOUT_MIN} and "
            f"{TIMEOUT_MAX} seconds"
        )
    return value


def validate_tool_approval_policy(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if not cleaned:
        return None
    if cleaned not in TOOL_APPROVAL_POLICIES:
        raise SettingsValidationError(
            "Tool approval policy must be one of "
            + ", ".join(TOOL_APPROVAL_POLICIES)
        )
    return cleaned


def validate_capture_mode(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if cleaned not in AI_CAPTURE_MODES:
        raise SettingsValidationError(
            "Capture mode must be one of " + ", ".join(AI_CAPTURE_MODES)
        )
    return cleaned


# --- Overrides --------------------------------------------------------------


def get_agent_override(
    db: Session, agent_version_id: UUID
) -> AgentConfigOverride | None:
    return db.scalar(
        select(AgentConfigOverride).where(
            AgentConfigOverride.agent_version_id == agent_version_id
        )
    )


def get_workflow_override(
    db: Session, organization_id: UUID, workflow_key: str
) -> WorkflowConfigOverride | None:
    return db.scalar(
        select(WorkflowConfigOverride).where(
            WorkflowConfigOverride.organization_id == organization_id,
            WorkflowConfigOverride.workflow_key == workflow_key,
        )
    )


# --- Resolution -------------------------------------------------------------


def _first_value(sources: list[tuple[str, Any]]) -> tuple[str, Any]:
    for source, value in sources:
        if value is not None:
            return source, value
    return "server_default", None


def resolve_effective_config(
    db: Session,
    organization_id: UUID,
    version: AgentVersion,
    workflow_key: str | None = None,
    run_override: dict | None = None,
) -> dict:
    """Resolve the configuration a run is executed with.

    The result contains the effective value of every overridable setting
    together with the source it came from, so the UI can show whether a
    setting is inherited or overridden.
    """
    workspace = get_or_create_workspace_settings(db, organization_id)
    agent_override = get_agent_override(db, version.id)
    workflow_override = (
        get_workflow_override(db, organization_id, workflow_key)
        if workflow_key
        else None
    )
    run = run_override or {}

    def override_value(row, key: str):
        if row is None:
            return None
        return getattr(row, key, None)

    resolved: dict[str, dict] = {}

    model_source, model = _first_value(
        [
            ("run_override", run.get("model")),
            ("workflow_override", override_value(workflow_override, "model")),
            ("agent_override", override_value(agent_override, "model")),
            ("workspace_default", workspace.default_model),
            ("agent_version", version.model),
        ]
    )
    resolved["model"] = _setting(
        model or settings.llm_default_model,
        model_source,
        inherited=model_source
        in {"workspace_default", "agent_version", "server_default"},
        overridable=agent_override is not None
        and override_value(agent_override, "model") is not None,
    )

    temperature_source, temperature = _first_value(
        [
            (
                "run_override",
                run.get("temperature"),
            ),
            (
                "workflow_override",
                override_value(workflow_override, "temperature"),
            ),
            (
                "agent_override",
                override_value(agent_override, "temperature"),
            ),
            ("workspace_default", workspace.default_temperature),
            ("agent_version", version.temperature),
        ]
    )
    resolved["temperature"] = _setting(
        temperature if temperature is not None else 0.3,
        temperature_source,
        inherited=temperature_source
        in {"workspace_default", "agent_version", "server_default"},
        overridable=agent_override is not None
        and override_value(agent_override, "temperature") is not None,
    )

    timeout_source, timeout = _first_value(
        [
            ("run_override", run.get("agent_timeout_seconds")),
            (
                "workflow_override",
                override_value(workflow_override, "agent_timeout_seconds"),
            ),
            (
                "agent_override",
                override_value(agent_override, "agent_timeout_seconds"),
            ),
            (
                "workspace_default",
                workspace.default_agent_timeout_seconds,
            ),
        ]
    )
    resolved["agent_timeout_seconds"] = _setting(
        timeout if timeout is not None else settings.llm_timeout_seconds,
        timeout_source,
        inherited=timeout_source in {"workspace_default", "server_default"},
        overridable=agent_override is not None
        and override_value(agent_override, "agent_timeout_seconds")
        is not None,
    )

    policy_source, policy = _first_value(
        [
            ("run_override", run.get("tool_approval_policy")),
            (
                "workflow_override",
                override_value(workflow_override, "tool_approval_policy"),
            ),
            (
                "agent_override",
                override_value(agent_override, "tool_approval_policy"),
            ),
            (
                "workspace_default",
                workspace.default_tool_approval_policy,
            ),
        ]
    )
    # The workspace requirement is mandatory: no override can weaken it.
    effective_policy = policy or "optional"
    policy_locked = False
    if workspace.require_tool_approval:
        effective_policy = "require"
        policy_locked = True
    resolved["tool_approval_policy"] = _setting(
        effective_policy,
        policy_source if not policy_locked else "workspace_default",
        inherited=policy_source
        in {"workspace_default", "server_default"}
        and not policy_locked,
        overridable=agent_override is not None
        and override_value(agent_override, "tool_approval_policy")
        is not None
        and not policy_locked,
    )
    resolved["tool_approval_policy"]["locked_by_policy"] = policy_locked

    allowed_models = list(workspace.allowed_models or [])
    effective_model = resolved["model"]["value"]
    model_allowed = (not allowed_models) or effective_model in allowed_models

    return {
        "settings": resolved,
        "capture_mode": workspace.ai_capture_mode,
        "restrictions": {
            "allowed_models": allowed_models,
            "require_tool_approval": bool(workspace.require_tool_approval),
            "model_allowed": model_allowed,
        },
    }


def _setting(
    value: Any,
    source: str,
    inherited: bool,
    overridable: bool,
) -> dict:
    return {
        "value": value,
        "source": source,
        "source_label": SOURCE_LABELS.get(source, source),
        "inherited": inherited,
        "overridden": not inherited,
        "reset_available": overridable,
    }


def enforce_resolution(
    db: Session, organization_id: UUID, resolved: dict
) -> None:
    """Raise when the resolved configuration violates a mandatory rule."""
    restrictions = resolved.get("restrictions") or {}
    if not restrictions.get("model_allowed", True):
        model = resolved["settings"]["model"]["value"]
        raise SettingsValidationError(
            f"Model “{model}” is not allowed by the workspace policy"
        )
    if restrictions.get("require_tool_approval"):
        policy = resolved["settings"]["tool_approval_policy"]
        if policy["value"] != "require":
            raise SettingsValidationError(
                "The workspace requires approval for tool calls"
            )


# --- Run snapshots ----------------------------------------------------------


def store_run_snapshot(
    db: Session,
    organization_id: UUID,
    agent_id: UUID | None,
    agent_version_id: UUID | None,
    workflow_key: str | None,
    run_id: str | None,
    resolved: dict,
) -> RunConfigSnapshot:
    """Freeze the resolved configuration of a run."""
    snapshot = RunConfigSnapshot(
        organization_id=organization_id,
        agent_id=agent_id,
        agent_version_id=agent_version_id,
        workflow_key=workflow_key,
        run_id=run_id,
        resolved_config={
            key: value.get("value")
            for key, value in resolved.get("settings", {}).items()
        },
        sources={
            key: value.get("source")
            for key, value in resolved.get("settings", {}).items()
        },
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
