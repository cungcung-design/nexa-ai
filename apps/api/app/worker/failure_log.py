"""Count failed Celery jobs without storing their arguments or results."""

from __future__ import annotations

FAILED_JOBS_KEY = "nexa:monitor:failed-jobs"


def record_task_failure(task_name: str | None, redis_client) -> None:
    """Increment the counter for one task name.

    The exception and the task arguments stay out of Redis. A document body
    or a chat message is never a task name.
    """
    name = task_name or "unknown"
    redis_client.hincrby(FAILED_JOBS_KEY, name, 1)


def record_from_signal(sender=None, **_kwargs) -> None:
    """Celery failure hook. Errors while counting are ignored."""
    from app.core.config import settings

    try:
        import redis

        client = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        try:
            record_task_failure(getattr(sender, "name", None), client)
        finally:
            client.close()
    except Exception:
        return
