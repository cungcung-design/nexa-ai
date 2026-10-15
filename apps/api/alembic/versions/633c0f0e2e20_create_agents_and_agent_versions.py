"""create agents and agent versions

Revision ID: 633c0f0e2e20
Revises: 267117e2f532
Create Date: 2026-10-13 19:20:31.674062

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '633c0f0e2e20'
down_revision: Union[str, Sequence[str], None] = '267117e2f532'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create agents table
    op.create_table(
        'agents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, default='', server_default=''),
        sa.Column('is_archived', sa.Boolean(), nullable=False, default=False, server_default='false'),
        sa.Column('published_version_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_agents_org_created', 'agents', ['organization_id', 'created_at'])
    op.create_unique_constraint('uq_agents_org_id', 'agents', ['organization_id', 'id'])

    # Create agent_versions table
    op.create_table(
        'agent_versions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=False),
        sa.Column('max_tokens', sa.Integer(), nullable=False),
        sa.Column('tools_config', JSONB, nullable=False, default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_agent_versions_agent_created', 'agent_versions', ['agent_id', 'created_at'])
    op.create_unique_constraint('uq_agent_version_identity', 'agent_versions', ['agent_id', 'id'])
    op.create_unique_constraint('uq_agent_version_number', 'agent_versions', ['agent_id', 'version_number'])
    op.create_foreign_key(
        'fk_agent_versions_org_agent', 'agent_versions', 'agents',
        ['organization_id', 'agent_id'], ['organization_id', 'id'],
        ondelete='CASCADE'
    )
    op.create_check_constraint('ck_agent_versions_temperature', 'agent_versions', 'temperature >= 0 AND temperature <= 2')
    op.create_check_constraint('ck_agent_versions_max_tokens', 'agent_versions', 'max_tokens >= 1 AND max_tokens <= 8192')
    op.create_check_constraint('ck_agent_versions_version_number', 'agent_versions', 'version_number >= 1')

    # Add foreign key for published_version_id (after both tables exist)
    op.create_foreign_key(
        'fk_agent_published_version', 'agents', 'agent_versions',
        ['id', 'published_version_id'], ['agent_id', 'id'],
        deferrable=True, initially='DEFERRED'
    )

    # Create knowledge_bases table
    op.create_table(
        'knowledge_bases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_knowledge_bases_org_created', 'knowledge_bases', ['organization_id', 'created_at'])
    op.create_unique_constraint('uq_knowledge_bases_org_id', 'knowledge_bases', ['organization_id', 'id'])

    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('knowledge_base_id', UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='PROCESSING', server_default='PROCESSING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_documents_kb_created', 'documents', ['knowledge_base_id', 'created_at'])
    op.create_unique_constraint('uq_documents_org_id', 'documents', ['organization_id', 'id'])
    op.create_foreign_key(
        'fk_documents_org_knowledge_base', 'documents', 'knowledge_bases',
        ['organization_id', 'knowledge_base_id'], ['organization_id', 'id'],
        ondelete='CASCADE'
    )
    op.create_check_constraint('ck_documents_status', 'documents', "status IN ('PROCESSING', 'READY', 'FAILED')")

    # Create document_chunks table
    op.create_table(
        'document_chunks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('knowledge_base_id', UUID(as_uuid=True), nullable=False),
        sa.Column('document_id', UUID(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(384), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_document_chunks_org_kb', 'document_chunks', ['organization_id', 'knowledge_base_id'])
    op.create_foreign_key(
        'fk_chunks_org_document', 'document_chunks', 'documents',
        ['organization_id', 'document_id'], ['organization_id', 'id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_chunks_org_knowledge_base', 'document_chunks', 'knowledge_bases',
        ['organization_id', 'knowledge_base_id'], ['organization_id', 'id'],
        ondelete='CASCADE'
    )
    # HNSW index for vector similarity search (created after table)
    op.execute('CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_document_chunks_embedding_hnsw', table_name='document_chunks', postgresql_using='hnsw')
    op.drop_table('document_chunks')
    op.drop_table('documents')
    op.drop_table('knowledge_bases')
    op.drop_constraint('fk_agent_published_version', 'agents', type_='foreignkey')
    op.drop_table('agent_versions')
    op.drop_table('agents')