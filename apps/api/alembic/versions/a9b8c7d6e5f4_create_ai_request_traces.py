"""create ai request traces

Revision ID: a9b8c7d6e5f4
Revises: e7f8a9b0c1d2
Create Date: 2026-10-22 13:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_request_traces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ai_request_traces_org_created",
        "ai_request_traces",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_ai_request_traces_organization_id",
        "ai_request_traces",
        ["organization_id"],
    )
    op.create_index(
        "ix_ai_request_traces_agent_id",
        "ai_request_traces",
        ["agent_id"],
    )
    op.create_table(
        "ai_execution_spans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["trace_id"],
            ["ai_request_traces.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_ai_execution_spans_trace_id",
        "ai_execution_spans",
        ["trace_id"],
    )
    op.create_index(
        "ix_ai_execution_spans_org_created",
        "ai_execution_spans",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_ai_execution_spans_organization_id",
        "ai_execution_spans",
        ["organization_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_execution_spans_organization_id",
        table_name="ai_execution_spans",
    )
    op.drop_index(
        "ix_ai_execution_spans_org_created",
        table_name="ai_execution_spans",
    )
    op.drop_index("ix_ai_execution_spans_trace_id", table_name="ai_execution_spans")
    op.drop_table("ai_execution_spans")
    op.drop_index("ix_ai_request_traces_agent_id", table_name="ai_request_traces")
    op.drop_index(
        "ix_ai_request_traces_organization_id",
        table_name="ai_request_traces",
    )
    op.drop_index(
        "ix_ai_request_traces_org_created",
        table_name="ai_request_traces",
    )
    op.drop_table("ai_request_traces")
