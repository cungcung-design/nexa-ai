from celery import Celery
from celery.signals import task_failure

from app.core.config import settings
from app.core.log_safety import install_redacting_logs
from app.worker.failure_log import record_from_signal

install_redacting_logs()

celery_app = Celery(
    "nexa_ai",
    broker=settings.redis_url,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    imports=("app.worker.health_tasks",),
    # Task arguments are identifiers. Do not keep results; they are unused
    # and a result payload could contain extracted document text.
    task_ignore_result=True,
)

task_failure.connect(record_from_signal)