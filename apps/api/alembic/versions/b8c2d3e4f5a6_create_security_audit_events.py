"""create security audit events table

Revision ID: b8c2d3e4f5a6
Revises: a7b3c9d1e2f4
Create Date: 2026-10-19 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a7b3c9d1e2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'security_audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_security_audit_events_organization_id', 'security_audit_events', ['organization_id'])
    op.create_index('ix_security_audit_events_org_created', 'security_audit_events', ['organization_id', 'created_at'])
    op.create_index('ix_security_audit_events_resource_id', 'security_audit_events', ['resource_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_security_audit_events_resource_id', table_name='security_audit_events')
    op.drop_index('ix_security_audit_events_org_created', table_name='security_audit_events')
    op.drop_index('ix_security_audit_events_organization_id', table_name='security_audit_events')
    op.drop_table('security_audit_events')
