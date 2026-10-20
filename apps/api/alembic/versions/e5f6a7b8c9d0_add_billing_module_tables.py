"""add billing module tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-20 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "organization_subscriptions",
        sa.Column(
            "interval",
            sa.String(length=20),
            nullable=False,
            server_default="monthly",
        ),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column(
            "price_amount", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column(
            "currency",
            sa.String(length=10),
            nullable=False,
            server_default="usd",
        ),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column("checkout_session_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organization_subscriptions",
        sa.Column(
            "checkout_created_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    op.create_table(
        "billing_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "company_name",
            sa.String(length=150),
            nullable=False,
            server_default="",
        ),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("tax_id", sa.String(length=120), nullable=True),
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
            "organization_id", name="uq_billing_profile_org"
        ),
    )

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "provider_invoice_id", sa.String(length=255), nullable=False
        ),
        sa.Column("number", sa.String(length=120), nullable=False),
        sa.Column(
            "status", sa.String(length=40), nullable=False, server_default="draft"
        ),
        sa.Column(
            "currency",
            sa.String(length=10),
            nullable=False,
            server_default="usd",
        ),
        sa.Column("amount_due", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hosted_invoice_url", sa.Text(), nullable=True),
        sa.Column("invoice_pdf", sa.Text(), nullable=True),
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
            "organization_id",
            "provider_invoice_id",
            name="uq_invoice_org_provider",
        ),
    )
    op.create_index(
        "ix_invoices_org_created",
        "invoices",
        ["organization_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "payment_methods",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "provider_payment_method_id", sa.String(length=255), nullable=False
        ),
        sa.Column(
            "brand", sa.String(length=40), nullable=False, server_default="card"
        ),
        sa.Column(
            "last4", sa.String(length=8), nullable=False, server_default=""
        ),
        sa.Column("exp_month", sa.Integer(), nullable=True),
        sa.Column("exp_year", sa.Integer(), nullable=True),
        sa.Column("holder_name", sa.String(length=150), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
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
            "provider_payment_method_id",
            name="uq_payment_method_provider",
        ),
    )
    op.create_index(
        "ix_payment_methods_org",
        "payment_methods",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "daily_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column(
            "request_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "workflow_executions",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "storage_mb", sa.Float(), nullable=False, server_default="0"
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
            "organization_id", "day", name="uq_daily_usage_org_day"
        ),
    )
    op.create_index(
        "ix_daily_usage_org_day",
        "daily_usage",
        ["organization_id", "day"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_daily_usage_org_day", table_name="daily_usage")
    op.drop_table("daily_usage")
    op.drop_index("ix_payment_methods_org", table_name="payment_methods")
    op.drop_table("payment_methods")
    op.drop_index("ix_invoices_org_created", table_name="invoices")
    op.drop_table("invoices")
    op.drop_table("billing_profiles")

    op.drop_column("organization_subscriptions", "checkout_created_at")
    op.drop_column("organization_subscriptions", "checkout_session_id")
    op.drop_column("organization_subscriptions", "canceled_at")
    op.drop_column("organization_subscriptions", "cancel_at_period_end")
    op.drop_column("organization_subscriptions", "current_period_end")
    op.drop_column("organization_subscriptions", "current_period_start")
    op.drop_column("organization_subscriptions", "currency")
    op.drop_column("organization_subscriptions", "price_amount")
    op.drop_column("organization_subscriptions", "interval")
