"""Persistence models for the settings module.

Three different scopes are stored here:

* :class:`UserSettings` holds the personal settings of a single account.
* :class:`WorkspaceSettings` holds the defaults a workspace applies to every
  agent that does not override them.
* :class:`AgentConfigOverride` and :class:`WorkflowConfigOverride` hold the
  explicit overrides that sit between the workspace default and a single
  run.
* :class:`RunConfigSnapshot` freezes the resolved configuration of a run so
  later settings changes never rewrite history.

Every override column is nullable on purpose: ``NULL`` means "inherit" and
is different from an explicit value such as ``0``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models import utc_now


class UserSettings(Base):
    """Personal settings of one account."""

    __tablename__ = "user_settings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_settings_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(150), nullable=False, default="", server_default=""
    )
    job_title: Mapped[str] = mapped_column(
        String(150), nullable=False, default="", server_default=""
    )
    language: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en", server_default="en"
    )
    appearance: Mapped[str] = mapped_column(
        String(20), nullable=False, default="system", server_default="system"
    )
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="UTC", server_default="UTC"
    )
    notify_approvals: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_workflow_failures: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_agent_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_security_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_billing_updates: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    notification_channel_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notification_channel_in_app: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class WorkspaceSettings(Base):
    """Workspace wide defaults and policies."""

    __tablename__ = "workspace_settings"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", name="uq_workspace_settings_org"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # AI defaults. NULL means the setting is not set by the workspace and
    # the agent keeps its own value.
    default_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    default_temperature: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    default_agent_timeout_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    default_tool_approval_policy: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    #: Models the workspace allows. An empty list allows every model the
    #: backend supports.
    allowed_models: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    #: Mandatory tool approval. This is a workspace policy and can never be
    #: weakened by an agent, workflow or run override.
    require_tool_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    #: ``dynamic`` resolves inherited defaults when a run starts, ``snapshot``
    #: captures them when an agent version is published.
    ai_capture_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="dynamic", server_default="dynamic"
    )
    session_timeout_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=480, server_default="480"
    )
    retention_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=365, server_default="365"
    )
    allow_data_export: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class AgentConfigOverride(Base):
    """Explicit agent level overrides for one published agent version.

    The row is keyed by the agent version so that publishing a new version
    never changes the configuration of the version that is already live.
    """

    __tablename__ = "agent_config_overrides"
    __table_args__ = (
        UniqueConstraint(
            "agent_version_id", name="uq_agent_config_overrides_version"
        ),
        Index(
            "ix_agent_config_overrides_org_agent",
            "organization_id",
            "agent_id",
        ),
        CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ck_agent_config_overrides_temperature",
        ),
        CheckConstraint(
            "agent_timeout_seconds IS NULL OR "
            "(agent_timeout_seconds >= 5 AND agent_timeout_seconds <= 3600)",
            name="ck_agent_config_overrides_timeout",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    agent_timeout_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    tool_approval_policy: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class WorkflowConfigOverride(Base):
    """Workflow level overrides for one workspace."""

    __tablename__ = "workflow_config_overrides"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "workflow_key",
            name="uq_workflow_config_overrides_org_key",
        ),
        CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ck_workflow_config_overrides_temperature",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workflow_key: Mapped[str] = mapped_column(
        String(120), nullable=False, index=True
    )
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    agent_timeout_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    tool_approval_policy: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class RunConfigSnapshot(Base):
    """The configuration a single run was executed with.

    The snapshot is written when the run starts and is never updated, so a
    later settings change cannot rewrite what a historical run used.
    """

    __tablename__ = "run_config_snapshots"
    __table_args__ = (
        Index(
            "ix_run_config_snapshots_org_created",
            "organization_id",
            "created_at",
        ),
        Index(
            "ix_run_config_snapshots_org_agent",
            "organization_id",
            "agent_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    agent_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    workflow_key: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    run_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, index=True
    )
    resolved_config: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    sources: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
