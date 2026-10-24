"""add langgraph checkpoint schema

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-10-21 23:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the schema LangGraph uses for workflow checkpoints.

    The checkpoint tables themselves are created by PostgresSaver.setup()
    when the API starts. Keeping them in this schema separates them from
    application-owned tables.
    """
    op.execute("CREATE SCHEMA IF NOT EXISTS langgraph")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS langgraph CASCADE")
