"""add password reset tokens and the session version of an account

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-20 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column(
            'token_version',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
    )

    op.create_table(
        'password_reset_tokens',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index(
        'ix_password_reset_tokens_token_hash',
        'password_reset_tokens',
        ['token_hash'],
        unique=True,
    )
    op.create_index(
        'ix_password_reset_tokens_user_id',
        'password_reset_tokens',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        'ix_password_reset_tokens_user_created',
        'password_reset_tokens',
        ['user_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'ix_password_reset_tokens_user_created',
        table_name='password_reset_tokens',
    )
    op.drop_index(
        'ix_password_reset_tokens_user_id',
        table_name='password_reset_tokens',
    )
    op.drop_index(
        'ix_password_reset_tokens_token_hash',
        table_name='password_reset_tokens',
    )
    op.drop_table('password_reset_tokens')
    op.drop_column('users', 'token_version')
