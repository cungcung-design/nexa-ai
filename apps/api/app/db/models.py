import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Enum,
)
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class Role(PyEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    DEVELOPER = "DEVELOPER"
    VIEWER = "VIEWER"


class MembershipStatus(PyEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    email_verification_token_hash: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    email_verification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_hash: Mapped[str] = mapped_column(String(255))
    #: Bumped whenever the password of the account changes. Access tokens
    #: carry the value they were issued with, so a bump invalidates every
    #: session that was opened before the change.
    token_version: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class PasswordResetToken(Base):
    """Single use password reset tokens.

    Only the hash of the token is stored, so a leaked database row can never
    be turned back into a working reset link. A token is used once, expires
    after a short window and is replaced by every newer request.
    """

    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        Index(
            "ix_password_reset_tokens_user_created",
            "user_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class OnboardingState(Base):
    """The personal onboarding progress of a user.

    The row keeps the step the user reached, the steps that are already
    finished, and the workspace, plan, and agent that belong to the
    onboarding. It lets a user leave the flow and continue later without
    repeating the work that is already done.
    """

    __tablename__ = "onboarding_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    step: Mapped[str] = mapped_column(
        String(40), default="welcome", nullable=False
    )
    completed_steps: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    plan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(
        String(150), unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class Membership(Base):
    __tablename__ = "memberships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role_enum", create_constraint=True),
        default=Role.VIEWER,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=MembershipStatus.ACTIVE.value,
        server_default=MembershipStatus.ACTIVE.value,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    user: Mapped["User"] = relationship(back_populates="memberships")
    organization: Mapped["Organization"] = relationship(
        back_populates="memberships"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "organization_id", name="uq_user_organization"
        ),
    )


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_agents_org_id",
        ),
        Index(
            "ix_agents_org_created",
            "organization_id",
            "created_at",
        ),
        ForeignKeyConstraint(
            ["id", "published_version_id"],
            ["agent_versions.agent_id", "agent_versions.id"],
            name="fk_agent_published_version",
            use_alter=True,
            deferrable=True,
            initially="DEFERRED",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default=""
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    published_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    versions: Mapped[list["AgentVersion"]] = relationship(
        back_populates="agent",
        cascade="all, delete-orphan",
        foreign_keys="AgentVersion.agent_id",
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"
    __table_args__ = (
        UniqueConstraint(
            "agent_id",
            "id",
            name="uq_agent_version_identity",
        ),
        UniqueConstraint(
            "agent_id",
            "version_number",
            name="uq_agent_version_number",
        ),
        ForeignKeyConstraint(
            ["organization_id", "agent_id"],
            ["agents.organization_id", "agents.id"],
            name="fk_agent_versions_org_agent",
            ondelete="CASCADE",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "temperature >= 0 AND temperature <= 2",
            name="ck_agent_versions_temperature",
        ),
        CheckConstraint(
            "max_tokens >= 1 AND max_tokens <= 8192",
            name="ck_agent_versions_max_tokens",
        ),
        CheckConstraint(
            "version_number >= 1",
            name="ck_agent_versions_version_number",
        ),
        Index(
            "ix_agent_versions_agent_created",
            "agent_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    tools_config: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    agent: Mapped["Agent"] = relationship(
        back_populates="versions",
        foreign_keys=[agent_id],
    )


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_knowledge_bases_org_id",
        ),
        Index(
            "ix_knowledge_bases_org_created",
            "organization_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    documents: Mapped[list["Document"]] = relationship(
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_documents_org_id",
        ),
        ForeignKeyConstraint(
            ["organization_id", "knowledge_base_id"],
            ["knowledge_bases.organization_id", "knowledge_bases.id"],
            name="fk_documents_org_knowledge_base",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_documents_status",
        ),
        Index(
            "ix_documents_kb_created",
            "knowledge_base_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    storage_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    processing_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    knowledge_base: Mapped["KnowledgeBase"] = relationship(
        back_populates="documents",
        foreign_keys=[knowledge_base_id],
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="DocumentChunk.document_id",
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "document_id"],
            ["documents.organization_id", "documents.id"],
            name="fk_chunks_org_document",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["organization_id", "knowledge_base_id"],
            ["knowledge_bases.organization_id", "knowledge_bases.id"],
            name="fk_chunks_org_knowledge_base",
            ondelete="CASCADE",
        ),
        Index(
            "ix_document_chunks_org_kb",
            "organization_id",
            "knowledge_base_id",
        ),
        Index(
            "ix_document_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    document: Mapped["Document"] = relationship(
        back_populates="chunks",
        foreign_keys=[document_id],
    )


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_conversation_org_id",
        ),
        ForeignKeyConstraint(
            ["organization_id", "agent_id"],
            ["agents.organization_id", "agents.id"],
            ondelete="CASCADE",
        ),
        Index(
            "ix_conversations_owner_created",
            "organization_id",
            "created_by",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, default="New conversation"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        foreign_keys="ConversationMessage.conversation_id",
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "conversation_id"],
            ["conversations.organization_id", "conversations.id"],
            name="fk_messages_org_conversation",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "role IN ('user', 'assistant', 'system')",
            name="ck_messages_role",
        ),
        Index(
            "ix_messages_conversation_created",
            "conversation_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    conversation: Mapped["Conversation"] = relationship(
        back_populates="messages",
        foreign_keys=[conversation_id],
    )


class WorkflowApproval(Base):
    __tablename__ = "workflow_approvals"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "thread_id",
            name="uq_workflow_approval_thread",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    thread_id: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    arguments: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING"
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            name="uq_org_subscription_org",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    plan: Mapped[str] = mapped_column(
        String(20),
        default="FREE",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="ACTIVE",
        nullable=False,
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
    )
    #: Billing interval of the subscription: ``monthly`` or ``yearly``.
    interval: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="monthly",
    )
    #: Price of the subscribed plan in the smallest currency unit.
    price_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="usd",
    )
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    #: True when the subscription is cancelled but stays active until the
    #: end of the paid period.
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    canceled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    #: Open Stripe checkout session, used to block duplicate checkouts.
    checkout_session_id: Mapped[str | None] = mapped_column(String(255))
    checkout_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "period",
            name="uq_monthly_usage_org_period",
        ),
        CheckConstraint(
            "request_count >= 0",
            name="ck_usage_request_nonnegative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    period: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
    )
    request_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    prompt_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    completion_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class AgentDeployment(Base):
    __tablename__ = "agent_deployments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "agent_id"],
            ["agents.organization_id", "agents.id"],
            name="fk_deployments_org_agent",
            ondelete="CASCADE",
            deferrable=True,
            initially="DEFERRED",
        ),
        Index(
            "ix_agent_deployments_org_created",
            "organization_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    public_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    allowed_origins: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    event_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    processed: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class BillingProfile(Base):
    """Billing contact information of a workspace."""

    __tablename__ = "billing_profiles"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            name="uq_billing_profile_org",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    company_name: Mapped[str] = mapped_column(
        String(150), nullable=False, default=""
    )
    billing_email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    tax_id: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Invoice(Base):
    """An invoice issued for a workspace, mirrored from the provider."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "provider_invoice_id",
            name="uq_invoice_org_provider",
        ),
        Index("ix_invoices_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_invoice_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(40), nullable=False, default="draft"
    )
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="usd"
    )
    amount_due: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    amount_paid: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    tax_amount: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    hosted_invoice_url: Mapped[str | None] = mapped_column(Text)
    invoice_pdf: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class PaymentMethodRecord(Base):
    """A payment method attached to a workspace customer."""

    __tablename__ = "payment_methods"
    __table_args__ = (
        UniqueConstraint(
            "provider_payment_method_id",
            name="uq_payment_method_provider",
        ),
        Index("ix_payment_methods_org", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_payment_method_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    brand: Mapped[str] = mapped_column(
        String(40), nullable=False, default="card"
    )
    last4: Mapped[str] = mapped_column(
        String(8), nullable=False, default=""
    )
    exp_month: Mapped[int | None] = mapped_column(Integer)
    exp_year: Mapped[int | None] = mapped_column(Integer)
    holder_name: Mapped[str | None] = mapped_column(String(150))
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class DailyUsage(Base):
    """Daily consumption counters used for the billing usage trend."""

    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "day",
            name="uq_daily_usage_org_day",
        ),
        Index("ix_daily_usage_org_day", "organization_id", "day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    day: Mapped[str] = mapped_column(String(10), nullable=False)
    request_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    workflow_executions: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    storage_mb: Mapped[float] = mapped_column(
        Float, nullable=False, default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )



class IntegrationProvider(Base):
    __tablename__ = "integration_providers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(150), unique=True, index=True, nullable=False
    )
    description: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default=""
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other"
    )
    auth_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="api_key"
    )
    config_schema: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    capabilities: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class WorkspaceConnection(Base):
    __tablename__ = "workspace_connections"
    __table_args__ = (
        Index("ix_workspace_connections_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending"
    )
    auth_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="api_key"
    )
    scopes: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    encrypted_credentials: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    config: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    last_tested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_tested_ok: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    provider: Mapped["IntegrationProvider"] = relationship(
        foreign_keys=[provider_id]
    )


class ConnectionAgentAccess(Base):
    __tablename__ = "connection_agent_access"
    __table_args__ = (
        UniqueConstraint(
            "connection_id", "agent_id", name="uq_connection_agent_access"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspace_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actions: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class ConnectionWorkflowAccess(Base):
    __tablename__ = "connection_workflow_access"
    __table_args__ = (
        UniqueConstraint(
            "connection_id", "workflow_id", "step_key",
            name="uq_connection_workflow_access",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspace_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    step_key: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class IntegrationWebhook(Base):
    __tablename__ = "integration_webhooks"
    __table_args__ = (
        Index("ix_integration_webhooks_org_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspace_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    target_url: Mapped[str] = mapped_column(String(500), nullable=False)
    events: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class IntegrationWebhookDelivery(Base):
    __tablename__ = "integration_webhook_deliveries"
    __table_args__ = (
        Index(
            "ix_integration_webhook_deliveries_webhook_created",
            "webhook_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    webhook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_webhooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    request_payload: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    response_status: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class IntegrationActivity(Base):
    __tablename__ = "integration_activity"
    __table_args__ = (
        Index(
            "ix_integration_activity_org_created",
            "organization_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspace_connections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    webhook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_webhooks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activity_metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class ApprovalPolicy(Base):
    __tablename__ = "approval_policies"
    __table_args__ = (
        Index(
            "ix_approval_policies_org_enabled",
            "organization_id",
            "is_enabled",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_pattern: Mapped[str] = mapped_column(String(100), nullable=False)
    risk_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium"
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class ApprovalAssignment(Base):
    __tablename__ = "approval_assignments"
    __table_args__ = (
        UniqueConstraint(
            "policy_id", "user_id", name="uq_approval_assignment_policy_user",
        ),
        Index(
            "ix_approval_assignments_org_user",
            "organization_id",
            "user_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    policy_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_policies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class ContactMessage(Base):
    """A message that a visitor sent through the contact form.

    The row keeps the request even when no mail server is available, so the
    team can answer the message later.
    """

    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(String(60), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
