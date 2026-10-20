import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class SecurityAuditEvent(Base):
    """A single immutable audit record for one organization.

    The record keeps a stable public reference (``event_id``), the actor
    snapshot (so the entry stays readable after an account is deleted), the
    outcome of the action and any recorded configuration difference.
    """

    __tablename__ = "security_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    event_sequence: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    event_id: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="user",
    )
    actor_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    actor_email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )

    action: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="other",
    )
    categories: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)),
        nullable=False,
        default=list,
    )
    outcome: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="success",
    )

    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    resource_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="web_application",
    )
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    changes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    __table_args__ = (
        Index("ix_security_audit_events_org_created", "organization_id", "created_at"),
        Index("ix_security_audit_events_org_category", "organization_id", "category"),
        Index("ix_security_audit_events_org_outcome", "organization_id", "outcome"),
        Index(
            "ix_security_audit_events_org_sequence",
            "organization_id",
            "event_sequence",
            unique=True,
        ),
        UniqueConstraint(
            "organization_id",
            "event_id",
            name="uq_security_audit_events_org_event_id",
        ),
    )


class AuditExport(Base):
    """A generated export of audit records.

    The row tracks the real lifecycle of the export (queued -> processing ->
    completed/failed) and points at the stored artifact so authorized members
    can download it later.
    """

    __tablename__ = "audit_exports"

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
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    export_format: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="csv",
    )
    scope: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="filtered",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="queued",
    )
    record_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    filters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_audit_exports_org_created", "organization_id", "created_at"),
    )
