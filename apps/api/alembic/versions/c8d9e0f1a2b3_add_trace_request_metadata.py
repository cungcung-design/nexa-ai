"""add trace request metadata

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-10-22 20:55:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_request_traces",
        sa.Column("model", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "ai_request_traces",
        sa.Column(
            "agent_version_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "ai_execution_spans",
        sa.Column("detail", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_execution_spans", "detail")
    op.drop_column("ai_request_traces", "agent_version_id")
    op.drop_column("ai_request_traces", "model")
