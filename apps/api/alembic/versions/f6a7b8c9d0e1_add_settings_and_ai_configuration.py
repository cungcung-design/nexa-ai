"""add settings, workspace AI configuration and run snapshots

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-20 15:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "user_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "full_name",
            sa.String(length=150),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "job_title",
            sa.String(length=150),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "language",
            sa.String(length=20),
            nullable=False,
            server_default="en",
        ),
        sa.Column(
            "appearance",
            sa.String(length=20),
            nullable=False,
            server_default="system",
        ),
        sa.Column(
            "timezone",
            sa.String(length=64),
            nullable=False,
            server_default="UTC",
        ),
        sa.Column(
            "notify_approvals",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_workflow_failures",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_agent_alerts",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_security_alerts",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_billing_updates",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "notification_channel_email",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notification_channel_in_app",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_settings_user"),
    )
    op.create_index(
        "ix_user_settings_user_id", "user_settings", ["user_id"], unique=False
    )

    op.create_table(
        "workspace_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("default_model", sa.String(length=100), nullable=True),
        sa.Column("default_temperature", sa.Float(), nullable=True),
        sa.Column("default_agent_timeout_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "default_tool_approval_policy", sa.String(length=30), nullable=True
        ),
        sa.Column(
            "allowed_models",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "require_tool_approval",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "ai_capture_mode",
            sa.String(length=20),
            nullable=False,
            server_default="dynamic",
        ),
        sa.Column(
            "session_timeout_minutes",
            sa.Integer(),
            nullable=False,
            server_default="480",
        ),
        sa.Column(
            "retention_days",
            sa.Integer(),
            nullable=False,
            server_default="365",
        ),
        sa.Column(
            "allow_data_export",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id", name="uq_workspace_settings_org"
        ),
    )
    op.create_index(
        "ix_workspace_settings_organization_id",
        "workspace_settings",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "agent_config_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "agent_version_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("agent_timeout_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "tool_approval_policy", sa.String(length=30), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ck_agent_config_overrides_temperature",
        ),
        sa.CheckConstraint(
            "agent_timeout_seconds IS NULL OR "
            "(agent_timeout_seconds >= 5 AND agent_timeout_seconds <= 3600)",
            name="ck_agent_config_overrides_timeout",
        ),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["agent_version_id"],
            ["agent_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "agent_version_id", name="uq_agent_config_overrides_version"
        ),
    )
    op.create_index(
        "ix_agent_config_overrides_agent_id",
        "agent_config_overrides",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        "ix_agent_config_overrides_agent_version_id",
        "agent_config_overrides",
        ["agent_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_agent_config_overrides_organization_id",
        "agent_config_overrides",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_agent_config_overrides_org_agent",
        "agent_config_overrides",
        ["organization_id", "agent_id"],
        unique=False,
    )

    op.create_table(
        "workflow_config_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("workflow_key", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("agent_timeout_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "tool_approval_policy", sa.String(length=30), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ck_workflow_config_overrides_temperature",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "workflow_key",
            name="uq_workflow_config_overrides_org_key",
        ),
    )
    op.create_index(
        "ix_workflow_config_overrides_organization_id",
        "workflow_config_overrides",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_config_overrides_workflow_key",
        "workflow_config_overrides",
        ["workflow_key"],
        unique=False,
    )

    op.create_table(
        "run_config_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "agent_version_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("workflow_key", sa.String(length=120), nullable=True),
        sa.Column("run_id", sa.String(length=120), nullable=True),
        sa.Column(
            "resolved_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "sources",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_run_config_snapshots_organization_id",
        "run_config_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_run_config_snapshots_agent_id",
        "run_config_snapshots",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        "ix_run_config_snapshots_run_id",
        "run_config_snapshots",
        ["run_id"],
        unique=False,
    )
    op.create_index(
        "ix_run_config_snapshots_org_created",
        "run_config_snapshots",
        ["organization_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_run_config_snapshots_org_agent",
        "run_config_snapshots",
        ["organization_id", "agent_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("run_config_snapshots")
    op.drop_table("workflow_config_overrides")
    op.drop_table("agent_config_overrides")
    op.drop_table("workspace_settings")
    op.drop_table("user_settings")
