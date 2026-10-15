"""add updated_at to conversations and fix created_by nullable

Revision ID: f3f7bf0c9ff7
Revises: 2a35eac8bbce
Create Date: 2026-10-13 20:33:47.660558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3f7bf0c9ff7'
down_revision: Union[str, Sequence[str], None] = '2a35eac8bbce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add updated_at column with default
    op.add_column('conversations', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    
    # Make created_by nullable
    op.alter_column('conversations', 'created_by', nullable=True)
    
    # Fix foreign key ondelete for created_by to SET NULL
    op.drop_constraint('conversations_created_by_fkey', 'conversations', type_='foreignkey')
    op.create_foreign_key(
        'conversations_created_by_fkey',
        'conversations', 'users',
        ['created_by'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('conversations_created_by_fkey', 'conversations', type_='foreignkey')
    op.create_foreign_key(
        'conversations_created_by_fkey',
        'conversations', 'users',
        ['created_by'], ['id'],
        ondelete='CASCADE'
    )
    op.alter_column('conversations', 'created_by', nullable=False)
    op.drop_column('conversations', 'updated_at')