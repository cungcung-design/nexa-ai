"""add PENDING to document status check constraint

Revision ID: 2d4cef2694e7
Revises: 137edca0f844
Create Date: 2026-10-13 22:20:06.660836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d4cef2694e7'
down_revision: Union[str, Sequence[str], None] = '137edca0f844'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop old check constraint and add new one with PENDING
    op.drop_constraint('ck_documents_status', 'documents', type_='check')
    op.create_check_constraint(
        'ck_documents_status',
        'documents',
        "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_documents_status', 'documents', type_='check')
    op.create_check_constraint(
        'ck_documents_status',
        'documents',
        "status IN ('PROCESSING', 'READY', 'FAILED')"
    )