"""add workspace invitations and membership status

Revision ID: d4e5f6a7b8c9
Revises: c9d4e5f6a7b8
Create Date: 2026-10-20 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c9d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "memberships",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="ACTIVE",
        ),
    )
    op.create_index(
        "ix_memberships_status", "memberships", ["status"], unique=False
    )

    op.create_table(
        "organization_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_organization_invitations_email",
        "organization_invitations",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_organization_invitations_organization_id",
        "organization_invitations",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_organization_invitations_status",
        "organization_invitations",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_organization_invitations_token_hash",
        "organization_invitations",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_organization_invitations_org_status",
        "organization_invitations",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "uq_organization_invitations_pending_email",
        "organization_invitations",
        ["organization_id", "email"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "uq_organization_invitations_pending_email",
        table_name="organization_invitations",
    )
    op.drop_index(
        "ix_organization_invitations_org_status",
        table_name="organization_invitations",
    )
    op.drop_index(
        "ix_organization_invitations_token_hash",
        table_name="organization_invitations",
    )
    op.drop_index(
        "ix_organization_invitations_status",
        table_name="organization_invitations",
    )
    op.drop_index(
        "ix_organization_invitations_organization_id",
        table_name="organization_invitations",
    )
    op.drop_index(
        "ix_organization_invitations_email",
        table_name="organization_invitations",
    )
    op.drop_table("organization_invitations")
    op.drop_index("ix_memberships_status", table_name="memberships")
    op.drop_column("memberships", "status")
