import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class AIRequestTrace(Base):
    __tablename__ = "ai_request_traces"
    __table_args__ = (
        Index("ix_ai_request_traces_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    status: Mapped[String] = mapped_column(
        String(20), nullable=False, default="success"
    )
    error_code: Mapped[String | None] = mapped_column(String(100), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    agent_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class AIExecutionSpan(Base):
    __tablename__ = "ai_execution_spans"
    __table_args__ = (
        Index("ix_ai_execution_spans_trace_id", "trace_id"),
        Index("ix_ai_execution_spans_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    trace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_request_traces.id", ondelete="CASCADE"),
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    name: Mapped[String] = mapped_column(String(50), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[String] = mapped_column(
        String(20), nullable=False, default="success"
    )
    error_code: Mapped[String | None] = mapped_column(String(100), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class AIEvaluationCase(Base):
    __tablename__ = "ai_evaluation_cases"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "id",
            name="uq_ai_evaluation_cases_org_id",
        ),
        Index(
            "ix_ai_evaluation_cases_org_created",
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
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    input: Mapped[String] = mapped_column(Text, nullable=False)
    expected_substring: Mapped[String] = mapped_column(
        String(255), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class AIEvaluationResult(Base):
    __tablename__ = "ai_evaluation_results"
    __table_args__ = (
        Index(
            "ix_ai_evaluation_results_org_created",
            "organization_id",
            "created_at",
        ),
        Index(
            "ix_ai_evaluation_results_case_id",
            "case_id",
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
        index=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_evaluation_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    passed: Mapped[Boolean] = mapped_column(
        Boolean, nullable=False, default=False
    )
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )