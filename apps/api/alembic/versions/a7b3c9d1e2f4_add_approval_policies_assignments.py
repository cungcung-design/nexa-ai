"""add approval policies and assignments tables

Revision ID: a7b3c9d1e2f4
Revises: 45309cb5b43d
Create Date: 2026-10-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7b3c9d1e2f4'
down_revision: Union[str, Sequence[str], None] = '45309cb5b43d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'approval_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('action_pattern', sa.String(100), nullable=False),
        sa.Column('risk_level', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_approval_policies_organization_id', 'approval_policies', ['organization_id'])
    op.create_index('ix_approval_policies_org_enabled', 'approval_policies', ['organization_id', 'is_enabled'])

    op.create_table(
        'approval_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('policy_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['policy_id'], ['approval_policies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('policy_id', 'user_id', name='uq_approval_assignment_policy_user'),
    )
    op.create_index('ix_approval_assignments_organization_id', 'approval_assignments', ['organization_id'])
    op.create_index('ix_approval_assignments_org_user', 'approval_assignments', ['organization_id', 'user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_approval_assignments_org_user', table_name='approval_assignments')
    op.drop_index('ix_approval_assignments_organization_id', table_name='approval_assignments')
    op.drop_table('approval_assignments')
    op.drop_index('ix_approval_policies_org_enabled', table_name='approval_policies')
    op.drop_index('ix_approval_policies_organization_id', table_name='approval_policies')
    op.drop_table('approval_policies')
