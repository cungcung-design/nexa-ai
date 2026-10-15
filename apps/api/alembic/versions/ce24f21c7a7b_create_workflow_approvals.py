"""create workflow approvals

Revision ID: ce24f21c7a7b
Revises: 633c0f0e2e20
Create Date: 2026-10-13 19:59:25.401532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'ce24f21c7a7b'
down_revision: Union[str, Sequence[str], None] = '633c0f0e2e20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'workflow_approvals',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', UUID(as_uuid=True), nullable=False),
        sa.Column('thread_id', sa.String(100), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('arguments', JSONB, nullable=False, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('requested_by', UUID(as_uuid=True), nullable=True),
        sa.Column('decided_by', UUID(as_uuid=True), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['decided_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'thread_id', name='uq_workflow_approval_thread'),
    )
    op.create_index('ix_workflow_approvals_organization_id', 'workflow_approvals', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_workflow_approvals_organization_id', table_name='workflow_approvals')
    op.drop_table('workflow_approvals')