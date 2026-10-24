"""create organization api keys

Revision ID: b7c8d9e0f1a2
Revises: a9b8c7d6e5f4
Create Date: 2026-10-22 17:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization_api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("key_prefix", sa.String(length=20), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_organization_api_keys_organization_id",
        "organization_api_keys",
        ["organization_id"],
    )
    op.create_index(
        "ix_organization_api_keys_key_prefix",
        "organization_api_keys",
        ["key_prefix"],
    )
    op.create_index(
        "ix_organization_api_keys_org_active",
        "organization_api_keys",
        ["organization_id", "is_active"],
    )
    op.create_index(
        "uq_organization_api_keys_key_hash",
        "organization_api_keys",
        ["key_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_organization_api_keys_key_hash",
        table_name="organization_api_keys",
    )
    op.drop_index(
        "ix_organization_api_keys_org_active",
        table_name="organization_api_keys",
    )
    op.drop_index(
        "ix_organization_api_keys_key_prefix",
        table_name="organization_api_keys",
    )
    op.drop_index(
        "ix_organization_api_keys_organization_id",
        table_name="organization_api_keys",
    )
    op.drop_table("organization_api_keys")
