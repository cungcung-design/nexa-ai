"""create users organizations memberships

Revision ID: 267117e2f532
Revises: 09bfe969ad37
Create Date: 2026-10-13 18:39:06.393650

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '267117e2f532'
down_revision: Union[str, Sequence[str], None] = '09bfe969ad37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create role enum type
    role_enum = sa.Enum('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER', name='role_enum', create_type=False)
    role_enum.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('slug', sa.String(150), unique=True, index=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Create memberships table
    op.create_table(
        'memberships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('role', role_enum, nullable=False, default='VIEWER'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('memberships')
    op.drop_table('organizations')
    op.drop_table('users')
    role_enum = sa.Enum('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER', name='role_enum')
    role_enum.drop(op.get_bind(), checkfirst=True)