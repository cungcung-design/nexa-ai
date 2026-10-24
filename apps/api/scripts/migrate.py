"""Apply Alembic migrations once, under a Postgres advisory lock.

The lock is session-scoped. A second migrate process exits immediately
instead of applying the same revision at the same time. The command is
always ``upgrade head``. It does not downgrade or recreate the database.
"""

from __future__ import annotations

import os
import subprocess
import sys

from sqlalchemy import create_engine, text

LOCK_KEY = 867530901


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is required", file=sys.stderr)
        return 1

    engine = create_engine(database_url, pool_pre_ping=True)
    connection = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    acquired = connection.execute(
        text("SELECT pg_try_advisory_lock(:key)"),
        {"key": LOCK_KEY},
    ).scalar()
    if not acquired:
        print("another migration is already running", file=sys.stderr)
        connection.close()
        engine.dispose()
        return 1

    print("alembic upgrade head", flush=True)
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=False,
        )
        if completed.returncode != 0:
            print("migration failed", file=sys.stderr)
            return completed.returncode
        print("migration finished", flush=True)
        return 0
    finally:
        connection.execute(
            text("SELECT pg_advisory_unlock(:key)"),
            {"key": LOCK_KEY},
        )
        connection.close()
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
