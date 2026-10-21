"""add email verification and onboarding state

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-21 01:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column(
            'email_verified',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        'users',
        sa.Column('email_verification_token_hash', sa.String(128), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column(
            'email_verification_expires_at',
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'email_verification_sent_at',
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_table(
        'onboarding_states',
        sa.Column(
            'user_id',
            UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            primary_key=True,
        ),
        sa.Column('step', sa.String(40), nullable=False, server_default='welcome'),
        sa.Column(
            'completed_steps',
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column('workspace_id', UUID(as_uuid=True), nullable=True),
        sa.Column('plan', sa.String(20), nullable=True),
        sa.Column('agent_id', UUID(as_uuid=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('onboarding_states')
    op.drop_column('users', 'email_verification_sent_at')
    op.drop_column('users', 'email_verification_expires_at')
    op.drop_column('users', 'email_verification_token_hash')
    op.drop_column('users', 'email_verified')
