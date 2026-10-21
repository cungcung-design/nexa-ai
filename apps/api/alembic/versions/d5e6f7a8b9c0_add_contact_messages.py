"""add contact messages

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-10-21 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'contact_messages',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('subject', sa.String(length=60), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_contact_messages_created_at',
        'contact_messages',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_contact_messages_created_at', table_name='contact_messages')
    op.drop_table('contact_messages')
