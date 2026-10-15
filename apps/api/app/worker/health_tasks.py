from datetime import datetime, timezone

from app.worker.celery_app import celery_app


@celery_app.task(name="nexa.health.ping")
def worker_ping():
    return {
        "status": "ok",
        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),
    }
