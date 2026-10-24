"""PostgreSQL checkpoint storage for human-in-the-loop workflows.

Checkpoint tables live in the ``langgraph`` schema so they stay separate
from application-owned tables. LangGraph owns the table definitions and
migrations through ``PostgresSaver.setup()``. There is no in-memory
fallback: if PostgreSQL is unavailable, workflow startup fails.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

CHECKPOINT_SCHEMA = "langgraph"

_lock = threading.Lock()
_runtime: "CheckpointRuntime | None" = None
_graph = None


@dataclass
class CheckpointRuntime:
    pool: ConnectionPool
    saver: PostgresSaver

    def close(self) -> None:
        self.pool.close()


def checkpoint_database_url() -> str:
    """Return the PostgreSQL URL used for workflow checkpoints.

    ``CHECKPOINT_DATABASE_URL`` overrides ``DATABASE_URL`` so tests can
    target the test database. Both must be PostgreSQL. A missing or
    non-PostgreSQL URL is an error, not a cue to use process memory.
    """
    configured = os.environ.get("CHECKPOINT_DATABASE_URL", "").strip()
    database_url = configured or settings.database_url
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required for durable workflow checkpoints"
        )
    parsed = urlparse(database_url)
    scheme = parsed.scheme.split("+", 1)[0]
    if scheme not in {"postgresql", "postgres"}:
        raise RuntimeError(
            "Workflow checkpoints require PostgreSQL. "
            f"Refusing to use {scheme or 'an empty'} storage backend."
        )
    return urlunparse(parsed._replace(scheme="postgresql"))


def open_checkpoint_runtime() -> CheckpointRuntime:
    """Open a new pool and checkpointer.

    Each call owns its own pool. A restarted API process, or a test that
    needs a second graph, calls this again and reads the same rows.
    """
    conninfo = checkpoint_database_url()
    with Connection.connect(conninfo, autocommit=True) as connection:
        connection.execute(
            f"CREATE SCHEMA IF NOT EXISTS {CHECKPOINT_SCHEMA}"
        )

    def use_checkpoint_schema(connection: Connection) -> None:
        connection.execute(f"SET search_path TO {CHECKPOINT_SCHEMA}")

    pool = ConnectionPool(
        conninfo,
        min_size=1,
        max_size=10,
        timeout=10,
        open=False,
        configure=use_checkpoint_schema,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
            "row_factory": dict_row,
            "options": f"-c search_path={CHECKPOINT_SCHEMA}",
        },
    )
    pool.open(wait=True, timeout=10)
    try:
        saver = PostgresSaver(pool)
        saver.setup()
    except Exception:
        pool.close()
        raise
    return CheckpointRuntime(pool=pool, saver=saver)


def get_approval_graph():
    """Return the process-wide approval graph, opening PostgreSQL on first use."""
    global _graph, _runtime
    with _lock:
        if _graph is None:
            _runtime = open_checkpoint_runtime()
            from app.ai.workflows.approval import build_approval_graph

            _graph = build_approval_graph(_runtime.saver)
        return _graph


def shutdown_checkpointer() -> None:
    """Close the process-wide pool. The next use opens a new one."""
    global _graph, _runtime
    with _lock:
        runtime = _runtime
        _runtime = None
        _graph = None
    if runtime is not None:
        runtime.close()
