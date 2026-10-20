"""expand security audit events and add audit exports

Revision ID: c9d4e5f6a7b8
Revises: b8c2d3e4f5a6
Create Date: 2026-10-20 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.modules.security.audit import categorize_action

# revision identifiers, used by Alembic.
revision: str = 'c9d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b8c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'security_audit_events',
        sa.Column('event_sequence', sa.Integer(), nullable=True),
    )
    op.add_column(
        'security_audit_events',
        sa.Column('event_id', sa.String(32), nullable=True),
    )
    op.add_column(
        'security_audit_events',
        sa.Column(
            'actor_type', sa.String(32), nullable=False, server_default='user'
        ),
    )
    op.add_column(
        'security_audit_events',
        sa.Column('actor_name', sa.String(255), nullable=True),
    )
    op.add_column(
        'security_audit_events',
        sa.Column('actor_email', sa.String(320), nullable=True),
    )
    op.add_column(
        'security_audit_events',
        sa.Column(
            'category', sa.String(64), nullable=False, server_default='other'
        ),
    )
    op.add_column(
        'security_audit_events',
        sa.Column(
            'categories',
            postgresql.ARRAY(sa.String(64)),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
    )
    op.add_column(
        'security_audit_events',
        sa.Column(
            'outcome', sa.String(32), nullable=False, server_default='success'
        ),
    )
    op.add_column(
        'security_audit_events',
        sa.Column('resource_name', sa.String(255), nullable=True),
    )
    op.add_column(
        'security_audit_events',
        sa.Column(
            'source',
            sa.String(50),
            nullable=False,
            server_default='web_application',
        ),
    )
    op.add_column(
        'security_audit_events',
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Resources such as a workspace setting do not own a row of their own.
    op.alter_column(
        'security_audit_events', 'resource_id', existing_type=postgresql.UUID(), nullable=True
    )

    bind = op.get_bind()

    # Per organization sequence and public reference for existing rows.
    bind.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY organization_id ORDER BY created_at, id
                       ) AS rn
                FROM security_audit_events
            )
            UPDATE security_audit_events e
            SET event_sequence = ranked.rn
            FROM ranked
            WHERE e.id = ranked.id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE security_audit_events
            SET event_id = 'AUD-' || lpad(COALESCE(event_sequence, 1)::text, 4, '0')
            """
        )
    )

    # Categories are derived from the recorded action so that the filter
    # behaves the same for historical and new events.
    actions = bind.execute(
        sa.text("SELECT DISTINCT action FROM security_audit_events")
    ).fetchall()
    for (action,) in actions:
        primary, categories = categorize_action(action)
        bind.execute(
            sa.text(
                """
                UPDATE security_audit_events
                SET category = :category, categories = :categories
                WHERE action = :action
                """
            ),
            {
                "category": primary,
                "categories": categories,
                "action": action,
            },
        )

    bind.execute(
        sa.text(
            """
            UPDATE security_audit_events
            SET outcome = COALESCE(NULLIF(details->>'outcome', ''), 'success'),
                resource_name = COALESCE(NULLIF(details->>'resource_name', ''), NULL),
                actor_name = COALESCE(
                    NULLIF(details->>'actor_name', ''),
                    NULLIF(details->>'actor_email', ''),
                    actor_name
                ),
                actor_email = COALESCE(
                    NULLIF(details->>'actor_email', ''), actor_email
                )
            """
        )
    )

    op.create_index(
        'ix_security_audit_events_event_id',
        'security_audit_events',
        ['event_id'],
    )
    op.create_unique_constraint(
        'uq_security_audit_events_org_event_id',
        'security_audit_events',
        ['organization_id', 'event_id'],
    )
    op.create_index(
        'ix_security_audit_events_org_category',
        'security_audit_events',
        ['organization_id', 'category'],
    )
    op.create_index(
        'ix_security_audit_events_org_outcome',
        'security_audit_events',
        ['organization_id', 'outcome'],
    )
    op.create_index(
        'ix_security_audit_events_org_sequence',
        'security_audit_events',
        ['organization_id', 'event_sequence'],
        unique=True,
    )

    op.create_table(
        'audit_exports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('export_format', sa.String(16), nullable=False, server_default='csv'),
        sa.Column('scope', sa.String(32), nullable=False, server_default='filtered'),
        sa.Column('status', sa.String(32), nullable=False, server_default='queued'),
        sa.Column('record_count', sa.Integer(), nullable=True),
        sa.Column('filters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('storage_key', sa.String(255), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_audit_exports_organization_id', 'audit_exports', ['organization_id']
    )
    op.create_index(
        'ix_audit_exports_org_created',
        'audit_exports',
        ['organization_id', 'created_at'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_audit_exports_org_created', table_name='audit_exports')
    op.drop_index('ix_audit_exports_organization_id', table_name='audit_exports')
    op.drop_table('audit_exports')

    op.drop_index(
        'ix_security_audit_events_org_sequence', table_name='security_audit_events'
    )
    op.drop_index(
        'ix_security_audit_events_org_outcome', table_name='security_audit_events'
    )
    op.drop_index(
        'ix_security_audit_events_org_category', table_name='security_audit_events'
    )
    op.drop_constraint(
        'uq_security_audit_events_org_event_id',
        'security_audit_events',
        type_='unique',
    )
    op.drop_index(
        'ix_security_audit_events_event_id', table_name='security_audit_events'
    )

    op.drop_column('security_audit_events', 'changes')
    op.drop_column('security_audit_events', 'source')
    op.drop_column('security_audit_events', 'resource_name')
    op.drop_column('security_audit_events', 'outcome')
    op.drop_column('security_audit_events', 'categories')
    op.drop_column('security_audit_events', 'category')
    op.drop_column('security_audit_events', 'actor_email')
    op.drop_column('security_audit_events', 'actor_name')
    op.drop_column('security_audit_events', 'actor_type')
    op.drop_column('security_audit_events', 'event_id')
    op.drop_column('security_audit_events', 'event_sequence')

    op.alter_column(
        'security_audit_events',
        'resource_id',
        existing_type=postgresql.UUID(),
        nullable=False,
    )
